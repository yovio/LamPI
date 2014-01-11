/*
 * transmitter.c:
 * Copyright (c) 2013 Maarten Westenberg.
 **************************************************************************************
 *
 *    LamPI is free software: you can redistribute it and/or modify
 *    it under the terms of the GNU Lesser General Public License as published by
 *    the Free Software Foundation, either version 3 of the License, or
 *    (at your option) any later version.
 *
 *    Software is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    GNU Lesser General Public License for more details.
 *
 *    You should have received a copy of the GNU Lesser General Public License
 *    along with LamPI.  If not, see <http://www.gnu.org/licenses/>.
 *
 *
 **********************************************************************************************
 */

#include <stdio.h>
#include <string.h>
#include <errno.h>
#include <stdlib.h>
#include <wiringPi.h>
#include <math.h>
#include <time.h>
#include <unistd.h>
#include <netdb.h>
#include <sys/types.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <arpa/inet.h>
#include "cJSON.h"
#include "LamPI.h"

extern int verbose;

// Declarations for Sockets

int sockfd;	
struct timeval timeout;	

static volatile int stop_ints;				

// ----------------------------------------------------------------------------------
//
// XXX We really need to figure out the -p (outpin) for wiringPi value
//
int dkaku(char *gaddr, char *uaddr, char *val)
{
	int ret;
	char fname[255];
	// Match the GUI values 1-32 for the dimmer to the device
	// values of 0-15
	if (strcmp(val,"on")==0)  sprintf(fname,"/home/pi/exe/kaku -g %s -n %s on", gaddr,uaddr);
	else 
	if (strcmp(val,"off")==0) sprintf(fname,"/home/pi/exe/kaku -g %s -n %s off", gaddr,uaddr);
	else {
		int ivalue= (int) ( (atoi(val)-1)/2 );
		sprintf(fname,"cd /home/pi/exe; ./kaku -g %s -n %s %d", gaddr,uaddr,ivalue);
	}
	printf("dtransmit:: %s\n",fname);
	ret = system(fname);
	if (ret == -1) fprintf(stderr,"system failed");
	return(0);

}

// ----------------------------------------------------------------------------------
// Universal transmit for well known transmitter. 
// In dtransmit we check whether the tramsnitter value is a well-known device in the 
// /home/pi/exe directory.
//
// XXX Both the exe directory and the pin number need to be configurable
//
int send_2_device(char *brand, char *gaddr, char *uaddr, char *val)
{
	int ret;
	char fname[255];
	sprintf(fname,"cd /home/pi/exe; ./%s -g %s -n %s %s", brand,gaddr,uaddr,val);
	printf("send_2_device:: %s\n",fname);
	ret = system(fname);
	if (ret == -1) {
		fprintf(stderr,"system failed");
		return (-1);
	}
	return(0);
}


// ----------------------------------------------------------------------------------
// Transmit a value to a device (over the air) using either a shell
// command directly.
// NOTE:: The command is called with the json arguments gaddr,uaddr and
//        not with the GUI addresses
//
//
int dtransmit(char *brand, char *gaddr, char *uaddr, char *val) 
{
	// Correct the unit code for action, old Kaku and Elro, that range from A-P 
	// The device specific executable uses unit addresses starting from 1 to n
	// And for Blokker that starts with 0, is corrected in the exe code.
	//
	//char dev[12];
	//sprintf(dev,"%c",(atoi(uaddr)+64) );
	if (strcmp(brand,"kaku") ==0)     { dkaku(gaddr,uaddr,val); return(0); }
	if (strcmp(brand,"action") ==0)   { send_2_device(brand,gaddr,uaddr,val); return(0); }
	if (strcmp(brand,"livolo") ==0)   { send_2_device(brand,gaddr,uaddr,val); return(0); }
	if (strcmp(brand,"elro") ==0)     { send_2_device(brand,gaddr,uaddr,val); return(0); }
	if (strcmp(brand,"blokker") ==0)  { send_2_device(brand,gaddr,uaddr,val); return(0); }
	if (strcmp(brand,"kiku") ==0)     { send_2_device(brand,gaddr,uaddr,val); return(0); }
	if (strcmp(brand,"kopou") ==0)    { send_2_device(brand,gaddr,uaddr,val); return(0); }
	
	printf("dtransmit:: brand not recognized %s\n", brand);
	return(-1);
};


//
// Parse the json array of values. NOTE: complex json arrays are not supported! Only one-level key->value
// The return value is a string, as all PHP json-encoded values are strings anyway!
// Therefore it is safe to assume that the we need to look in the array of children
// from the original root cJSON node
//
char * parse_cjson( cJSON * ptr, char * pattern )
{
	cJSON *child;
	if (ptr == NULL) {
		printf("parse_cjson:: Ptr is NULL\n");
		return NULL;
	}
	if (ptr->child == NULL) {
		printf("parse_cjson:: Child is NULL\n");
		return NULL;
	}
	child = ptr->child;
	
	while (child->next != NULL)
	{
		if ( (child->type == cJSON_String) &&
			 (strcmp(child->string, pattern)==0) )
		{
			return(child->valuestring);
		}
		//gtype = child->type ;
		//gname = child->string ;
		//gaddr = child->valuestring;
		child = child->next;
	}
	return(NULL);
}

/*
 *********************************************************************************
 * DAEMON mode
 * In daemon mode, the interrupt handler will itself post completed messages
 * to the main LamPI-daemon php program. In order to not spend too much wait time 
 * in the main program, we can either sleep or (which is better) listen to the 
 * LamPI-daemoan process for incoming messages to be sent to the transmitter.
 *
 * These messages could be either PINGs or requests to the transmitter to send
 * device messages to the various receiver programs.
 * XXX We could move this function to a separate .c file for readibility
 *********************************************************************************
 */
 
 int daemon_mode(char *hostname, char* port) 
 {
	char buf[MAXDATASIZE];					// For sending and receiving socket messages
	char *ptr1, *ptr2;
	int i;
 	int rc;
	fd_set fds;								// Socket Filedescriptor set
	
	char *jgaddr;	// Group address
	char *juaddr;
	char *jbrand;
	char *jval;
	char *ok;
	
	char *gname;	// Name
	int gtype;
	
	// ---------------- FOR DAEMON USE, OPEN SOCKETS ---------------------------------
	// If we choose daemon mode, we will need to open a socket for communication
	// This needs to be done BEFORE enabling the interrupt handler, as we want
	// the handler to send its code to the LamPI-daemon process 
	
	// Open a socket
	if ((sockfd = open_socket(hostname,port)) < 0) {
		fprintf(stderr,"Error opening socket for host %s. Exiting program\n\n", hostname);
		exit (1);
	};
	FD_ZERO(&fds);
	FD_SET(sockfd, &fds);
	
	// The command below is sort of initialization command to put the sender in 
	// a known state. Without it, there might be a proble when more than one Raspberry is
	// used for transmitting on the network. Unitialized it will apparently send noise ...
	// XXX Maybe just pulling the transmitter pin to 0 will work as well :-)
	
	send_2_device("kaku", "99", "1", "on");
	
	for (;;)
	{
		// If we run a daemon, the interrupt handler outputs to the LamPI-daemon directly
		// so this program ONLY needs to sleep in that case to save cpu cycles
		//
		if (verbose == 1) {
			printf("daemon_mode: transaction: %d, sleep: %d, sockerr: %d, stop_ints: %d\n",
								socktcnt, SLEEP, sockerr, stop_ints);
			fflush (stdout);
		}
			
		// Is the socket still alive? XXX we should not always do this once we are here,
		// but only once in every 60 seconds or so ....
		
		if (verbose == 1) printf("PING\n");
		sprintf(buf,"%d,PING",++socktcnt);					// Keep_Alive and check for connection
			
		if (write(sockfd, buf, strlen(buf)) == -1) {
			perror("Error writing to socket\n");
			close(sockfd);
			sleep(1);										// Allow socket to close down
			//
			// If reconnecting failed due to LamPI-daemon not running, we have to wait until
			// the daemon is restarted by cron after 60 secs and restart again.
			// The easiest way is to quit the program and let it be restarted by cron too
			// XXX better way is loop and try a few times
			i=0;
			while ( ((sockfd = open_socket(hostname,port)) < 0) && (i++ < 15) ) {
				fprintf(stderr,"Error opening socket connection to daemon %s, retry: %d",hostname,i);
				sleep(5);
			}	
			if (sockfd < 0) {
				fprintf(stderr,"Giving up: Error opening socket for host %s\n", hostname);
				exit(1);
			};
			if (verbose==1) printf("daemon_mode:: reopened the socket\n");
			// New socket created, hopefully we're fine now
		}
		
		// Now we have a connection still or again ...
		FD_ZERO(&fds);
		FD_SET(sockfd, &fds);
		timeout.tv_usec= 0;
		timeout.tv_sec = SLEEP;
			
		// Check for incoming socket messages. As longs as there is a message, read it, process it
		// If there are no fds ready, function returns 0, and we restart the loop
		
		while ((rc = select(sockfd+1, &fds, NULL, NULL, &timeout)) > 0)
		{
		  // Look at the filedescriptor, and see if this socket is selected
		  if (FD_ISSET(sockfd, &fds)) 
		  {
			if (verbose==1) printf("daemon_mode:: Message ready waiting on socket\n");
				
			rc = read(sockfd, buf, MAXDATASIZE); 
			if (rc == 0) {
				// Read error, break and establish new connection if necessary
				// If we break, we will automatically do a PING to check
				if (verbose == 1) printf("daemon_mode:: read error, connection lost?\n");
				close(sockfd);
				break;
			}
			buf[rc]=0;									// Terminate a string
			printf("Buf read:: <%s>\n",buf);
			
			ptr1 = buf;	
			cJSON *root;
			
			for (;;)
			{
				root = cJSON_ParseWithOpts((const char*) ptr1,(const char **)&ptr2,0);		// ptr contains end pos of parsed buf
				if (root == 0) {
					fprintf(stderr,"daemon_mode:: cJSON_ParseWithOps returned error\n");
					
					// If the parsing failed, it COULD be that we did miss part of the message
					// we can read another message and concatenate it to the end of this message
					// However, more likely that we receive a non-JSON message. So discard the message for the moment
				
					cJSON_Delete(root);
					break;
				}
				ok = parse_cjson(root, "action");		// My ad-on parsing function 
				if  ((ok != NULL) && (strcmp(ok,"ack") == 0))
								{ goto next; }		// Ignore OK messages for the receiver
				
				jbrand = parse_cjson(root, "brand");		// My ad-on parsing function 
				if (jbrand == NULL) { printf("parse_cjson jbrand returned NULL \n"); goto next; }
				
				jgaddr = parse_cjson(root, "gaddr");
				if (jgaddr == NULL) { printf("parse_cjson gaddr returned NULL \n"); goto next; }
				
				juaddr = parse_cjson(root, "uaddr");
				if (juaddr == NULL) { printf("parse_cjson uaddr returned NULL \n"); goto next; }
				
				jval = parse_cjson(root, "val");
				if (jval == NULL) {	printf("parse_cjson val returned NULL \n"); goto next; }
				
				printf("Json:: gaddr: %s, uaddr: %s, val: %s\n",jgaddr, juaddr, jval);
		
				// Now transmit the command to a device using function transmit
				//
				if (dtransmit(jbrand, jgaddr, juaddr, jval) == -1)
				{
					printf("transmit: returned error \n");
					continue;
				}
next:
				cJSON_Delete(root);
				
				// We know now that we parsed a JSON message. If there are more JSON messages
				// in the buffer, we will have to parse them as well. So move the ppointers in buf
				// and loop again.
			
				if ((ptr2 - buf) < rc) {
					// printf("daemon_mode:: Unparsed data in buf: %d chars, first char: %c\n",(buf+rc-ptr2), *ptr2);
					ptr1 = ptr2;
					ptr2 = NULL;
				}
				else {
					break;
				}
				
			}//for	
		  }// FD_ISSET

		}// while
		
		if (rc == -1) perror("select failed with value -1");	
		if (rc == 0) {
			// perror("select failed with value 0");				// XXX Remove, val 0 means no data
		}
		
		stop_ints=0;
		continue;										// Next loop
	}// for
 
	return(1);
 }
 