/*
 * LamPI-receiver.c:
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
 * LamPI-receiver.c:
 *
 * Program to read klikaanklikuit receivers (and to test receiver codes)
 * The program is part of the LamPI-daemon.php daemon code and
 * received remote codes will be transmitted to a receiving socket of the 
 * LamPI-dameon daemon or in test mode be printed on the terminal.
 *
 * Contributions, info used etc:
 *
 * I have taken the timing diagram of Wieltje which is one of the first
 * that I found for kaku. I also read wiringPi RC and sniffer examples
 * and read the pilight debug code of CurlyMo and others. 
 * However, none of the programs was fast, flexible or reliable enough 
 * or they did not offer the functions I needed.
 *	
 * How to test:
 *
 * The following command will loop forever (takes 100% cpu) waiting
 * for compleed messages by the interrup handler and then show the 
 * result:
 * 	> sudo ./LamPI-receiver -t -v -j -1
 *	
 * How to run the daemon:
 *
 * The following is typical use of the daemon function. By default it must make a socket
 * connect to the localhost and port 5000, but it allows other options set.
 * 
 *	> sudo ./LamPI-receiver -a -d [-h host] [-p port]
 *
 * The "daemon" uses sleep in the main program, as the results are reported
 * back by the interrupt handler itself. This mode is MUCH more efficient than
 * using the main program for that purpose. Only we need to clear the
 * interrupt handler as soon as possible.
 *
 * The variable "stop_ints" is used to temp stop the handler from gathering
 * bits (interrupts occur but handler returns immediately)
 * This is to prevent reentrancy and corruption of main program results in testmode.
 * 
 * ATTENTION
 * It is possible to register more than one interrupt handler on the same PIN.
 * This can as an exception be useful if two handlers interpret the same bitstream
 * for completely different protocols (eg weather station in combination with switches)
 * However, it will probably only work in damon mode as we sleep a lot in daemon mode :-)
 * In test mode both handlers are competing for time.....
 *
 **********************************************************************************************
 */
 
 
 
/**********************************************************************************************
 * Action/Impuls timing data
 * See http://dzrmo.wordpress.com/2012/07/08/remote-control-pt2272-for-android/
 * and the datasheet of the Princeton PT2262
 
        _     _
'0':   | |___| |___ (T,3T,T,3T)
        ___   ___
'1':   |   |_|   |_ (3T,T,3T,T)
        _     ___
float: | |___|   |_ (T,3T,3T,T) used in addresses

T = short period of ~120-200 µs. About 170 is standard OK!
According to documentation a pulse T consists of 4 clock cycles
With 433 MHz 

A full frame looks like this:

- start pulse: T high, 31T low (Total 32T), followed by 12 bits message 
  According to datasheet, there is a sync-bit or footer, but no header :-)

- 5 bit:  Address/Group/Room
- 5 bit:  Unit	(Only one bit be active), others are float (and can be made 0)
- 1 bit:  on-off
- 1 bit:  on-Off
- 1 Sync Bit: 1T high, 31T low (4 bits in length)

* So the total is 12 bits message + 4 bit times Sync = 16 bit = 16 * 8T pulses

- Shortcut Pulse decoding: Length of second pulse of every 4-pulse period gives decoded value

*********************************************************************************************** 
 */
 
/**********************************************************************************************
 * Keychain timing data
 * http://dzrmo.wordpress.com/2012/07/08/remote-control-pt2272-for-android/
 * and the datasheet of the Princeton PT2262
 * DRAAFT: I received a keychain remote controller with 4 buttons
 * I'm looking for the code and then I will include this remote in one of the receiver
 * programs.
 
        _     _
'0':   | |___| |___ (T,3T,T,3T)
        ___   ___
'1':   |   |_|   |_ (3T,T,3T,T)
        _     ___
float: | |___|   |_ (T,3T,3T,T) used in addresses

T = short period of ~200 µs. About 170 is standard OK as well!
According to documentation a pulse T consists of 4 clock cycles
With 433 MHz 

A full frame looks like this:

- start pulse: T high, 31T low (Total 32T), followed by 12 bits message 
  According to datasheet, there is a sync-bit or footer, but no header :-)

- 5 bit:  Address/Group/Room
- 5 bit:  Unit	(Only one bit be active), others are float (and can be made 0)
- 1 bit:  on-off
- 1 bit:  on-Off
- 1 Sync Bit: 1T high, 31T low (4 bits in length)

* So the total is 12 bits message + 4 bit times Sync = 16 bit = 16 * 8T pulses

- Shortcut Pulse decoding: Length of second pulse of every 4-pulse period gives decoded value

The code of this keychain FOB is almost identical to the Impuls remote controller
Only the left and right buttons seem to be transmitting the same code.
I have to open the remote to see whether the address is delectable, but at the
moment it is stuck to address 17, unit 0, with values ONn/Off

*********************************************************************************************** 
 */
 
/**********************************************************************************************
 * Klikaanklikuit timing data

Protocol. (Copied from Wieltje, 
http://www.circuitsonline.net/forum/view/message/1181410#1181410,
but with slightly different timings)
        _   _
'0':   | |_| |_____ (T,T,T,5T)
        _       _
'1':   | |_____| |_ (T,5T,T,T)
        _   _
dim:   | |_| |_     (T,T,T,T)

T = short period of ~260 - 295µs. 

A full frame looks like this:

- start pulse: 1T high, 10.44T low
- 26 bit:  Address
- 1  bit:  group bit
- 1  bit:  on/off/[dim]
- 4  bit:  unit
- [4 bit:  dim level. Only present if [dim] is chosen]
- stop pulse: 1T high, 40T low

At the moment the program only correctly discovers kaku remote controls. But if so, we
can connect more than just one or two as the program can use the same timing for all of them.

I do have mixed experience regarding using the Low-Pass hardware filter designed by CurlyMo (pilight.org).
When using that low-pass I lost more thn I liked. However, I was able to discover Impulse/Action
receivers, something that does not work at the moment.
However, receiving klikaanklikuit messages works very reliably and since I implemented these 
receiving functions as an interrupt handler (with a daemon doing sleeps more than enything else),
cpu time is low enough not to worry (measured with "vmstat 10" command in Linux/Wheezy

To connect other remotes or weather station, we need to integrate those timings into
the program. 

The commercial receivers for wall sockets etc are not timing sensitive and will only listen to
their own brand protocol. And as the 433MHz band is VERY noisy already, it is recommended
not to make code that listense to more than one or two protocols at the same time as it will
make the interrupt handler slooooowww and/or introduce a lot of bogus messages that need
to be discarded at a later time.

That said :-) I have the intention of building some sort of mechanism in the daemon that will
allow tuning of the main pulse timing parameter based on the output of the pulse in real life.
This is because the timing will differ for each remote.
The transmitter of the PI uses 295uSec for Kaku, whereas the real remote uses more like 250uSec.

***********************************************************************************************
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

// Set the values for pulse_time. You are advised to take the value as lowest as possible for
// your use. If you want Kaku only, set it to 260, but if you use action set it to 200 or so.
// The last version of the receiver uses AUTO-discovery, if so choose P_AUTO higher (500).
//
#define P_AUTO	500								// Pulse time for Auto mode, must be little lower than pulse_long
#define P_ACTION 150							// Pulse time for Action/Impulse receivers
#define P_KAKU 260								// Pulse time for Kaku receivers

#define SLEEP 30								// Sleeptime in daemon mode between two PING messages to LamPI-daemon
#define PORT "5000" 							// the port client will be connecting to 
#define MAXDATASIZE 1024 						// max number of bytes we can get at once 




// The pulse_time is the most important parameter for the system to recognize messages
// For kaku we work with 260 uSec which works quite OK.
// For action switches the pulse time is more like 150 uSec. This means that if we want to see
// both messages we should adapt the pulse time, or widen the 30% bandwidth in the low_pass var in main init.
// As an experiment, we set this value to the last bit before a new header!

static unsigned long edgeTimeStamp[2] = {0, };  // Timestamp of edges
static int volatile pulse_time = P_AUTO;		// This is the initial lenght of the pulse
static int pulse_array [255];					// Array to store the pulse timing
static int p_min = 8;							// Min amount of pulses in message 8 == 2 bit (for action/impuls is 52)
static int p_short;
static int p_long;
static int p_head = 1700;						// Min pulse time for header: for Kaku 2650, for Action 4660
static int p_footer = 3500;						// If larger than this value must be footer. For kaku
static int p_length=0;

static int binary    [255];						// Resulting bit stream
static int chk_array [255];						// For checking purposes
static int low_pass   = 80;						// Init so that min pulse_time - 30%  > low_pass

// Socket Stuff

int sockfd;
fd_set fds;
struct timeval timeout;
int sockerr;
int socktcnt = 0;								// Message counter, used in sockets and in reporting

//	Global variable to count interrupts. 
//	These variable are shared between main prog and interrupt handler
//	Should be declared volatile to avoid compiler to cache it.

static volatile int p_index = 0;				// Counter of pulses in interrupt routine
static volatile int duration = 0;				// actual duration of this edge interrupt (3 x T)
static volatile int footer = 0;
static volatile int header = 0;
static volatile int stop_ints = 0;
static volatile int pulse_long = 0;
static volatile int dflg = 0;
static int cflg = 0;
static int aflg = 0;							// Auto flag, Catch All ...
int verbose = 0;
int checks = 0;	

/*
 *********************************************************************************
 *
 * Function to count in standards pulse length, idea is copied from CurlyMO, RFSniffer etc
 * I'm not always sure this is the most elegant solution, as instead of using raw
 * timing data I would rather use the resulting bit code as a reference point for
 * comparing messages.
 *
 *********************************************************************************
 */
int normalize(int i) {
	double x;
	x=(double)i/pulse_time;						// XXX Should use value for this device

	return (int)(round(x));
}

/*
 *********************************************************************************
 * decode_pulse_train
 *
 * This function takes an array with timing info and translates to a bit array.
 * The intermediate step used is to first make the timing array a bit code where for
 * short pulses 1T we encode "0" and for 5T pulse_longs we encode "1".
 *
 * IN the 2nd step this intermediate result is converted to the final binary message.
 *
 * The function returns the length of the binary message that is outut in obuf
 *********************************************************************************
 */
int decode_pulse_kaku (int *ibuf, int *obuf) {

	int i;
	int j=0;
	int pulse_check;
	
	pulse_check = pulse_time * 3;				// Pulse before header is often shorter!!!
	
	// First value is the pulse_time
	// Second is the long pulse of the header, so start with 3rd
	// element in the code array
	
	for(i=2; i<(p_length-2); i+=4) {			// -2 as the last 2 pulses are stop bit
			
		if( ibuf[i+1] > pulse_check ) {
			obuf[j++]=1;
		} else {
			obuf[j++]=0;
		}
	}
	return ( (int)(j) );
}

// ***************************************
// Decode Action/Impuls equipment
//
// 
int decode_pulse_action (int *ibuf, int *obuf) {

	int i;
	int j=0;
	int pulse_check;
	
	pulse_check = pulse_time * 2;
	
	/* Convert the raw code into binary code */

	for (i=2; i<p_length-2; i+=4) {
		if ((ibuf[i]   <= pulse_check) && 
			(ibuf[i+1] >= pulse_check) &&
			(ibuf[i+2] <= pulse_check) &&
			(ibuf[i+3] >= pulse_check) ) {
				obuf[j++] = 0;
		}
		else 
		if ((ibuf[i]   >= pulse_check) && 
			(ibuf[i+1] <= pulse_check) &&
			(ibuf[i+2] >= pulse_check) &&
			(ibuf[i+3] <= pulse_check) ) {
				obuf[j++] = 1;	
		}
		else 
		if ((ibuf[i]   <= pulse_check) && 
			(ibuf[i+1] >= pulse_check) &&
			(ibuf[i+2] >= pulse_check) &&
			(ibuf[i+3] <= pulse_check) ) {
				obuf[j++] = 2;						// float
		}
		else {
				obuf[j++] = 3;						// The remote FOB seems to have HLLH encoding,
													// This is NOT according to the PT2260-R4 datasheet
		}
	}

	return ( (int)(j) );
}

/*
 *********************************************************************************
 * Lampi_Interrupt
 *
 * This is the main interrupt routine that is called as soon as we received an
 * edge (change) on the receiver GPIO pin of the RPI. As the timing is once every 
 * 250uSec, we have 1/4000 sec to do work before another edge arrives on the pin.
 * Therefore, the code is simple (for compiler) as long as we do not have completed
 * a message (received a valid header.
 * But as soon as we do, we probably have some time before a new header arrives
 * (protocol and bandwidth usage of 1%) which allows us to send a message
 * to the socket or print output.
 *
 * We need to include some sort of check, and as messages are transmitted 2 to 8
 * times by every remote (duh) we can check for 2 subsequent messages before
 * accepting the code sent.
 *********************************************************************************
 */
void lampi_interrupt (void) { 
	char sndbuf[MAXDATASIZE];
	int pulse_check;
	int buflen;
	int i;
	int is_eq;

	// We record the time at receiving an interrupt, and we keep track of the
	// time of the previous interrupt. The difference is duration of this edge
	// We need to handle the pulse, even if we're not doing anything with it
	// as we need to start with correct pulses.
	//
	edgeTimeStamp[0] = edgeTimeStamp[1];
    edgeTimeStamp[1] = micros();	
	duration = edgeTimeStamp[1] - edgeTimeStamp[0];		// time between 2 interrupts
	
	// As long as we process output, (we then have gathered a complete message) stop receiving!
	// In daemon mode, we will only briefly set stop_ints in the interrupt handler to output
	// on a socket and reset it immediately after.
	//
	if (stop_ints == 1) return;
	
	// Filter out too short or too long pulses. This method works as a low pass filter.
	// If the duration is shorter than the normalized pulse_lenght of
	// 260 - 295 uSec, then we must discard the message. There is much noise on the 433MHz
	// band and interrupt time must be kept short! We keep a 30% margin!
	//
	if ((duration < (int)(low_pass))					// Low pass filter
		|| (duration > 20000) 							// Filter timeout. 20000 is more than the largest sync pulse
		|| (p_index >= 255) )							// Buffer full since we started. messages are less than 140 chars
	{					
		goto reset;
	}

	//	
	// Action for every bit (also for the ones matching conditions above
	//
	pulse_array[p_index++] = duration;

	if ( duration < p_head ) return;					// Next pulse
	
	//
	// Special cases, if the duration is between 2000 and 3000 then this must be a header
	// or a footer pulse
	//
	// If we alread have a header pulse of around 9T to 10T, and we get a longer one of 15-20T 
	// then this must be a footer. 
	// The timing assumption for header AND assuming that preceding pulse is short
	// is the most important for the correct functioning of this program. 
	//

	if ((footer == 0) && (header == 0)) 
	{													// Footer == 0; This must be the header pulse
			header = duration;
			if (p_index>1) {							// Copy the last pulse before this header
				pulse_array[0] = pulse_array [p_index-2];
			}
			pulse_array[1] = duration;
			p_index = 2;								// If all right, bit 0 should be there as well and be LOW										
	}
		
	// If we have a header but another header arrives before we have a footer
	else if ((footer == 0) && (header > 0) && (duration < p_footer) )
	{
			header = duration;
			if (p_index>1) {
				pulse_array[0] = pulse_array [p_index-2];
			}
			pulse_array[1] = duration;
			p_index = 2;
	}
		
	// valid footer ??? Make message complete
	else if ( (footer == 0) && (header > 0) )	
	{								
			// Assume that every bit (containing four pulse periods) contains at least one short
			// and one long bit!! Except the dim bit, but that is way further up in the array
			// pulse_long is the length of the longer time (3T,4T or 5T), 4 or 5 times the pulse_time
			// It must be longer than the short pulse_time AND not so long that it could be a header ...
			// works as another type of filter too: There must be at least one pulse between 
			// header and footer :-) or we have an empty message
			
		if ((aflg>0) && (p_index >= 6 )) 
		{
				pulse_time = P_AUTO;					// must init larger than every known short pulse
				pulse_long = 200;						// must init shorter than every known long pulse
				for (i=2; i<6; i++) {
					if (pulse_array[i] < pulse_time ) pulse_time = pulse_array[i]+5;	// Take Smallest
					if (pulse_array[i] > pulse_long ) pulse_long = pulse_array[i];		// Take longest of 4 pulses
				}
		}
		
		//	
		// We have a footer, We are complete: Header, Footer, Pulse_time and Pulse_long
		//
		footer = duration;	
		
		stop_ints = 1;								// pause interrupts handling
			
		if (dflg>0) 								// Daemon flag, so report back over socket 
		{
				//Convert the raw timing code into bit code 
				// First 2 pulses the header, last 2 pulses the footer
				// XXX footer not yet been written to array
				
				buflen=0;
				pulse_check = pulse_time * 2;
				
				// Switch code is 32 bits * 4 pulses (every bit is 4 pulses) so total 128 pulses + 2 start + 2 stop
				// For a dimmer, we have to add another 4-bits, 16 pulses. However care must be taken when decoding
				// the dimmer bit, as it is SHORTER than a normal bit. The float bit is short-short-short-short
				
				if ((p_index == 132) || (p_index == 148))
				{
					for(i=2; i<(p_index-2); i+=4)
					{
						if((unsigned int)pulse_array[i+1] > (pulse_long - pulse_time) ) {
							binary[buflen++]=1;
						} 	
						else {
							binary[buflen++]=0;
						}
					}
				}	
					
				else 
				if (p_index == 52)						// Pulse Length of Impuls/Action and other 2702 
				{
					for(i=2; i<(p_index-2); i+=4)
					{												// 0: short-long-short-long
						if ((pulse_array[i]   <= pulse_check) && 
							(pulse_array[i+1] >= pulse_check) &&
							(pulse_array[i+2] <= pulse_check) &&
							(pulse_array[i+3] >= pulse_check) ) {
								binary[buflen++] = 0;
						}
						else 										// 1: long-short-long-short
						if ((pulse_array[i]   >= pulse_check) && 
							(pulse_array[i+1] <= pulse_check) &&
							(pulse_array[i+2] >= pulse_check) &&
							(pulse_array[i+3] <= pulse_check) ) {
								binary[buflen++] = 1;	
						}
						else 										// float: short-long-long-short 
						if ((pulse_array[i]   <= pulse_check) && 
							(pulse_array[i+1] >= pulse_check) &&
							(pulse_array[i+2] >= pulse_check) &&
							(pulse_array[i+3] <= pulse_check) ) {
								binary[buflen++] = 2;
						}
						else {
							binary[buflen++] = 3;					// float type 2 (unofficial): long-short-short-long
						}
					}
				}
				else {									// Yet unknown message, find out in test mode!
					stop_ints = 0;
					// printf("p_ind: %d, buflen: %d\n", p_index, buflen); fflush(stdout);
					return;
				}
			
			// QQQ
			
			// Check? We need at least two identical codes 
			// For -1, One equal binary code extra needed
			// For -2 we will check 2 times
			// For -3 will make this 3 or more times!
			
			if ((cflg>0) && (buflen > 0))	{
			
				// We check two or more codes with the binary, 
				// much easier than checking all non normalized
				is_eq = 1;
				for (i=0; i < buflen; i++) { 
				
					if (checks == 0) { 
						chk_array[i] = binary[i]; 		// just copy
					}										
					else if (binary[i] != chk_array[i]) {
						is_eq = 0;
						break;
					}
				}
				if (is_eq == 0)	{						// NOT equal => reset counter and loop
					//printf("Check %d fail bit %d\n",checks,i);
					checks = 0;
					goto reset;
				}
				else  
				if (checks < cflg) {
				
					checks++;							// One extra check complete								
					goto reset;							// break to next loop, no printing further
				}
				
				// If is_eq == 1 and checks == cflg we continue here
				
			}// cflg
			checks = 0;
			
			
			// QQQ
			// printf("p_ind: %d, buflen: %d\n", p_index, buflen); fflush(stdout);
				
			// In daemon mode, only if message is a kaku handset message of 32 or 36 bits
			//
			if ((buflen == 32) || (buflen == 36)) {
				
					// bit 0 - 25: First 26 bits are address
					// bit     26: Group Bit
					// bit     27: on/off/dim bit
					// bit 28- 31: Unit Code
					// ONLY for dimmer
					// bit 32- 36: dimmer value
					
					int address = 0; for (i=0; i<=25; i++) address = address*2 + binary[i];
					int group = binary[26];
					int onoff = binary[27];
					int unit = 0; for (i=28; i<=31; i++) unit = unit*2 + binary[i];
					
					// Dimmer only
					if (buflen == 36) {
						int dimlevel = 0; for (i=32; i<=35; i++) dimlevel = dimlevel * 2 + binary[i];
					}
					if (socktcnt >999) socktcnt = 0;				// Transaction counter reset
					
					// If group, send other message than if it is regular button
					if (group == 1) {
						//sprintf(sndbuf, 
						// "{ \"tcnt\":%d, \"action\":\"remote\", \"type\":\"raw\", \"message\":\"!A%dD%dG%d\"  }", 
						//		++socktcnt,address,unit,onoff);
						sprintf(sndbuf, "%d,!A%dD%dG%d", ++socktcnt,address,unit,group);	
					}
					else {
						// sprintf(sndbuf, 
						// "{ \"tcnt\":%d, \"action\":\"remote\", \"type\":\"raw\", \"message\":\"!A%dD%dF%d\"  }", 
						//		++socktcnt,address,unit,onoff);
						sprintf(sndbuf, "%d,!A%dD%dF%d", ++socktcnt, address,unit,onoff);
					}
						
					if (write(sockfd, sndbuf, strlen(sndbuf)) == -1) {
						sockerr = errno;
						fprintf(stderr,"socket write error\n");
						exit(1);
					}; 
			}//if 32 or 36
				
			else 											// Impuls/Action remotes
			if (buflen == 12) {
								
					int address = 0; 
					int unit = 0;
					int onoff = 0;
					
					for (i=0; i<=4; i++) {
						address = address * 2;
						if (binary[i]==1) address += binary[i];
					}
					 
					for (i=5; i<=9; i++) {					// Only the bitposition that is 0 is unit index, others float
						if (binary[i] == 0) {
							unit= i-5;
							continue;
						}
					}
					
					// The on-off state is encoded in 2 bits, 10 and 11.
					// One bit is 0, its position tells us whether we decode 0 or a 1
					// The other bit MUST be 2 (float) for "02" or "20" is allowed.
					// This enables us to check for empty "00" messages and discard those
					
					if ((binary[10] == 0) && (binary[11] == 2)) onoff = 0;			// Other bits are float
					else 
					if ((binary[11] == 0) && (binary[10] == 2)) onoff = 1;
					else 
					if ((binary[10] == 0) && (binary[11] == 3)) { onoff = 0; unit++; }	// Unofficial coding
					else
					if ((binary[11] == 0) && (binary[10] == 3)) { onoff = 1; unit++; }	// Unofficial coding
					
					else {
						stop_ints = 0;
						return;										// Wrong message format. Normal action is return
					}
						
					if (socktcnt >999) socktcnt = 0;		// Transaction counter reset
					sprintf(sndbuf, "%d,!A%dD%dF%d", ++socktcnt, address, unit, onoff);
					
					if (write(sockfd, sndbuf, strlen(sndbuf)) == -1) {
						sockerr = errno;
						fprintf(stderr,"socket write error\n");
						exit(1);
					};
			}// else buflen 12

reset:				
			//
			// Reset the message, and make all counters equal to 0 again.
			//
			p_index = 0;
			header = 0;
			footer = 0;
			pulse_long = 0;
			pulse_time = P_AUTO;
			stop_ints = 0;								// Accept new bits again
				
		}//if dflg
			
	}//if footer == 0, header>0, else we need pulse first

	return;
}

/*
 *********************************************************************************
 * Get In Addr
 *
 * get sockaddr, IPv4 or IPv6:
 *********************************************************************************
 */
void *get_in_addr(struct sockaddr *sa)
{
    if (sa->sa_family == AF_INET) {
        return &(((struct sockaddr_in*)sa)->sin_addr);
    }
    return &(((struct sockaddr_in6*)sa)->sin6_addr);
}

/*
 *********************************************************************************
 * Open Socket
 *********************************************************************************
 */
int open_socket(char *host, char *port) {

	int sockfd;  
    struct addrinfo hints, *servinfo, *p;
    int rv;
    char s[INET6_ADDRSTRLEN];

    memset(&hints, 0, sizeof hints);
    hints.ai_family = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;

    if ((rv = getaddrinfo(host, port, &hints, &servinfo)) != 0) {
        fprintf(stderr, "getaddrinfo: %s %s\n", host, gai_strerror(rv));
        return -1;
    }

    // loop through all the results and connect to the first we can
	
    for(p = servinfo; p != NULL; p = p->ai_next) {
	
        if ((sockfd = socket(p->ai_family, p->ai_socktype,
                p->ai_protocol)) == -1) {
            perror("client: socket");
            continue;
        }

        if (connect(sockfd, p->ai_addr, p->ai_addrlen) == -1) {
            close(sockfd);
			fprintf(stderr,"Address: %s, ", (char *) p->ai_addr);
            perror("client: connect");
            continue;
        }

        break;
    }

    if (p == NULL) {
        fprintf(stderr, "client: failed to connect\n");
        return -1;
    }

    inet_ntop(p->ai_family, get_in_addr((struct sockaddr *)p->ai_addr), s, sizeof s);
    printf("client: connecting to %s\n", s);

    freeaddrinfo(servinfo); // all done with this structure
	
	return(sockfd);
}


/*
 *********************************************************************************
 * DAEMON mode
 * In daemon mode, the interrupt handler will itself post completed messages
 * to the main LamPI-daemon php program. IN order to not spend too much wait time 
 * in the main program, we can either sleep or (which is better) listen to the 
 * LamPI-daemoan process for incoming messages.
 *
 * These messages could be either PINGs or requests to the transmitter to send
 * device messages to the various receiver programs.
 * XXX We could move this function to a separate .c file for readibility
 *********************************************************************************
 */
 
 int daemon_mode(char *hostname, char* port) 
 {
	char buf[MAXDATASIZE];					// For sending and receiving socket messages
	int i;
 	int rc;
	
	char *gaddr;	// Group address
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
	
	for (;;)
		{
			// If we run a daemon, the interrupt handler outputs to the LamPI-daemon directly
			// so this program ONLY needs to sleep in that case to save cpu cycles
			//
			if (verbose == 1) {
				printf("Daemon mode: %d, transaction: %d, sleep: %d, sockerr: %d, stop_ints: %d\n",
									dflg, socktcnt, SLEEP, sockerr, stop_ints);
				fflush (stdout);
			}
			
		// Is the socket still alive?
		if (verbose == 1) printf("PING ");
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
			while ( ((sockfd = open_socket(hostname,port)) < 0) && (i++<15) ) {
				fprintf(stderr,"Error opening socket connection to daemon %s, retry: %d",hostname,i);
				sleep(5);
			}	
			if (sockfd < 0) {
				fprintf(stderr,"Giving up: Error opening socket for host %s\n", hostname);
				exit (1);
			};
			if (verbose==1) printf("daemon:: reopened the socket\n");
			// New socket created, hopefully we're fine now
		}
		// Now we have a connection still or again ...
		FD_ZERO(&fds);
		FD_SET(sockfd, &fds);
		timeout.tv_usec= 0;
		timeout.tv_sec = SLEEP;
			
		// XXX Check for incoming socket messages?
		rc = select(sockfd+1, &fds, NULL, NULL, &timeout);
		if (rc == -1) perror("select failed");
		if (rc > 0) {
			if (FD_ISSET(sockfd, &fds)) {
				if (verbose==1) printf("daemon:: Message ready waiting on socket\n");
				rc = read(sockfd, buf, MAXDATASIZE); 
				buf[rc]=0;								// Terminate a string
				printf("Buf read:: <%s>\n",buf);
				
				cJSON *child;
				cJSON *root;
				
				root = cJSON_Parse(buf);
				
				gtype = root->type ;
				gname = root->string ;
				gaddr = root->valuestring;
				printf("Json:: type: %d, name: %s, gaddr: %s\n",gtype,gname,gaddr);
				
				if (root->child != NULL) {
					child = root->child;
					gtype = child->type ;
					gname = child->string ;
					gaddr = child->valuestring;
					printf("Json:: type: %d, name: %s, gaddr: %s\n",gtype,gname,gaddr);
				}
				
				if (child->next != NULL) {
					child = child->next;
					gtype = child->type ;
					gname = child->string ;
					gaddr = child->valuestring;
					printf("Json:: type: %d, name: %s, gaddr: %s\n",gtype,gname,gaddr);
				}
				
				cJSON_Delete(root);
				//cJSON_Delete(child);
			} 
			else {
				if (verbose==1) printf("Select returned rc value: %d\n",rc);
			}
		}
		else {
				if (verbose==1) printf("Select returned value: %d\n",rc);
		}
			
		stop_ints=0;
		// sleep(5);							// XXX remove later
		continue;										// Next loop
	}// for
 
	return(1);
 }
 
 

/*
 *********************************************************************************
 * main Program
 * The main program should ideally do not much more than collect the commandline
 * arguments, connect the interrupt handler and start sleeping (to save cpu cycles).
 *********************************************************************************
 */

int main (int argc, char **argv)
{
	int r_pin = 1;							// This is the Raspberry Programmable Interrupt Number
											// XXX Must be made an option on the commandline
	int is_eq;
	int i, j;								// counters
	int binary_length;


		
	// Vars for storing sniffer results
	int address = 0;
	int unit = 0;
	int dimlevel = 0;
	int value;
	
	// Vars for storing commandline options 
    int c;

						// Variable to keep track of number of checks on messages


	int jflg = 0;
    int tflg = 0;
	int kflg = 0;							// Kaku remote messages
	int iflg = 0;							// Action remote messages
	int xflg = 0;							// Xclusive, only Kaku, Action and/or other well known defines messages
	int errflg = 0;
	char *hostname = "localhost";
	char *port = PORT;
	
    extern char *optarg;
    extern int optind, optopt;
	
	// Vars for statistics
	unsigned long a_short_cnt, a_short_sum, a_long_cnt, a_long_sum, a_short_min, a_short_max, a_long_min, a_long_max;
	unsigned long p_short_cnt, p_short_sum, p_long_cnt, p_long_sum, p_short_min, p_short_max, p_long_min, p_long_max;
	unsigned long k_short_cnt, k_short_sum, k_long_cnt, k_long_sum,	k_short_min, k_short_max, k_long_min, k_long_max;

	// ------------------------- COMMANDLINE OPTIONS SETTING ----------------------
	// Valid options are:
	// -h <hostname> ; hostname or IP address of the daemon
	// -p <port> ; Portnumber for daemon socket
	// -a ; Catch all, find out the protocol yourself
	// -v ; Verbose, Give detailed messages
	// -d ; Daemon mode, output to daemon over socket connection
	// -i ; Impuls switches such as used for Action remotes
	// -t ; Test mode, output to screen (and gather some statistics)
	// -1 ; At least two equal messages in a row
	// -2 ; Equal to check -c
	// -3 ; Equal to check but now for 3 messages
	// -4 ; Equal to check but now for 4 messages
	// -k ; Show recognized Kaku messages of length 32 and 36 binary bits ONLY
	//
    while ((c = getopt(argc, argv, ":1234adh:ijkl:p:tvx")) != -1) 
	{
        switch(c) {
		case '1':
			cflg=1;
		break;
		case '2':						// Check, we test for at least 2 the same binary codes
			cflg=2;
		break;
		case '3':
			if (dflg>0) errflg++;
			cflg=3;
		break;
		case '4':
			if (dflg>0) errflg++;
			cflg=4;
		break;
		case 'a':
			aflg++;
		break;
        case 'd':						// Daemon mode, use socket communications, wait 1sec in loop and no output
            if (tflg>0) errflg++;
            else dflg++;
		break;
		case 'h':						// Socket communication
			if (tflg>0) errflg++;
            else dflg++;				// Need daemon flag too, (implied)
			hostname = optarg;
		break;
		case 'i':						// Impuls switches such as for Action
			iflg = 1;
		break;
		case 'j':						// For test/stdout output only, output a json string
			jflg = 1;
		break;
		case 'k':						// For test, enable kaku output
			if (dflg>0) errflg++;
			else tflg++;
			kflg++;
		break;
		case 'l':						// Low Pass filter setting
			low_pass = atoi(optarg);
			if ((low_pass<20) || (low_pass>pulse_time)) errflg++;
		break;
		case 'p':						// Port number
            port = optarg;
			if (tflg>0) errflg++;
            else dflg++;				// Need daemon flag too, (implied)
        break;
        case 't':						// Test mode and Daemon mode mutual exclusive
            if (dflg>0) errflg++;
            else tflg++;
		break;
		case 'v':						// Verbose, output long timing/bit strings
			verbose = 1;
		break;
		case 'x':
			xflg++;
		break;
		case ':':       				// -f or -o without operand
			fprintf(stderr,"Option -%c requires an operand\n", optopt);
			errflg++;
		break;
		case '?':
			fprintf(stderr, "Unrecognized option: -%c\n", optopt);
            errflg++;
        }
    }
    if (errflg) {
        fprintf(stderr, "usage: argv[0] (options) \n");
		fprintf(stderr, "\nFor daemon use:\n");
		fprintf(stderr, "-d\t\t; Daemon use, will send received code to daemon on socket\n");
		fprintf(stderr, "\t\t; Daemon use cannot be combined with testing -t\n");
		fprintf(stderr, "\t\t; -v verbose and other settings produce more output in testing mode than in daemon\n");
		fprintf(stderr, "-h hostname\t; Specify the hostname or IP address to connect to. Default is localhost\n");
		fprintf(stderr, "-p port\t\t; Specify the portnumber to connect to. Default is 5000\n");
		fprintf(stderr, "-j\t\t; Json output, will output in json format\n");
		
		fprintf(stderr, "\nFor testing:\n");
		fprintf(stderr, "-t\t\t; Test mode, will output received code from remote\n");
		fprintf(stderr, "\t\t; -v verbose and other settings produce more output in testing mode than in daemon\n");
		fprintf(stderr, "-1\t\t; Check, will check for 1 equal messages in sequence\n");
		fprintf(stderr, "-2\t\t; Check, will check for 2 equal messages in sequence\n");
		fprintf(stderr, "-3\t\t; Check, will check for 3 equal messages in sequence\n");
		fprintf(stderr, "-4\t\t; Check, will check for 4 equal messages in sequence\n");
		fprintf(stderr, "-k\t\t; Show kaku messages and gathers statistic (even is -v not set\n");
		
		fprintf(stderr, "\nOther settings:\n");
		fprintf(stderr, "-a\t\t; Show action/Impuls messages and their statistic (even is -v not set\n");
		fprintf(stderr, "-k\t\t; Show kaku messages and their statistic (even is -v not set\n");
		fprintf(stderr, "-l value\t; Low Pass, number of uSec at minimum that is needed to count as a edge/bit change\n");
		fprintf(stderr, "\t\t; This setting will affect other timing settings as well\n");
		fprintf(stderr, "-v\t\t; Verbose, will output more information about the received codes\n");
		fprintf(stderr, "-x\t\t; Xclusive mode, only well known devices\n");
		
        exit (2);
    }

	if (verbose == 1) {
	
		printf("The following options have been set:\n\n");
		printf("-v\t; Verbose option\n");
		if (dflg>0) printf("-d\t; Daemon option\n");
		if (tflg>0) printf("-t\t; Test option\n");
		if (iflg>0) printf("-i\t; Impuls option\n");
		if (kflg>0) printf("-k\t; Kaku option\n");
		if (xflg>0) printf("-x\t; Xclusive (only well known message formats) option\n");
		if (cflg==1) printf("-1\t; Check for 1 same message option\n");
		if (cflg==2) printf("-2\t; Check for 2 additional same messages\n");
		if (cflg==3) printf("-3\t; Check for 3 additional same messages\n");
		if (jflg>0) printf("-j\t; Json option\n");
		if (aflg>0) printf("-a\t; Auto Adapt option (experimental)\n");
		printf("\n");
	}
	

	
	// ----------------- FOR TEST USE, SET THE VARIABLES -----------------------------
	if ((kflg > 0) || (iflg >0)) {
		a_short_cnt = 0; 	a_short_sum = 0;	a_long_cnt = 0;
		a_long_sum = 0;		a_short_min = 0;	a_short_max = 0;	a_long_min = 0;	a_long_max = 0;
		p_short_cnt = 0;	p_short_sum = 0;	p_long_cnt = 0;
		p_long_sum = 0;		p_short_min = 0;	p_short_max = 0;	p_long_min = 0;	p_long_max = 0;
		k_short_cnt = 0;	k_short_sum = 0;	k_long_cnt = 0;
		k_long_sum = 0;		k_short_min = 0;	k_short_max = 0;	k_long_min = 0;	k_long_max = 0;
	}

	// Catch ALL learning setting
	//	
	if (aflg > 0) {
		pulse_time = P_AUTO;
	}
	else {
		pulse_time = P_KAKU+P_ACTION/2;						// Value in between these two protocols
		pulse_long = 0;
	}
	
	// ------------------ SETUP WIRINGPI --------------------------------------------
	// Now start with setup wiringPI
	//
	
	wiringPiSetup ();
	wiringPiISR (r_pin, INT_EDGE_BOTH, &lampi_interrupt) ;
	


	// -------------------- START THE MAIN LOOP OF THE PROGRAM ------------------------
	// LOOP Forever. for testing purposes (only) not delay, for daemon mode wait every second
	// XXX In daemon mode we can also receive messages every second on the socket if we want
	
	// ---------------------------------------------------------------
	// DAEMON mode communication between two socket connections only
	// When verbose flag is on, the program will output messages

	if (dflg>0) {
	
		daemon_mode(hostname, port);

	}// if dflg


	// ---------------------------------------------------------------------
	// NON DAEMON
	else for (;;)
	{
		// Do we have a complete message!! 
		// stop_ints is set to 1 so we can print message and clean up
		//
		if ( (stop_ints == 1) || ((header > 0) && (footer > 0) && (pulse_long>0)) )
		{
			p_length = p_index;							// Copy the index pos as it may be modded by interrupt handler
			binary_length = 0;
			
			if (p_length <= p_min) {
			
				p_index = 0;
				header = 0;
				footer = 0;
				pulse_long = 0;
				stop_ints = 0;
				continue;
			}
			
			if (!((header > 0) && (footer>0)) ) {
				fprintf(stderr,"Error: stop_ints 1, but no header and/or footer");
			}
			
			// Decode pulse array into bit string based on type of message (length of p_index
			// Is this a Kaku message?
			//
			if (( p_length == 132 ) || (p_length == 148)) {
				
				binary_length = decode_pulse_kaku(pulse_array, binary);
				//printf("Decoding Kaku, length = %d \n",binary_length);
			}
			// Is this an Action/Impuls message?
			else 
			if ( p_length == 52 ) {
				binary_length = decode_pulse_action(pulse_array, binary);
				//printf("Decoding Action, length = %d\n",binary_length);
			}
			
			// Xclusive flag: If the length of the decoded message less than length of 
			// action or kaku message stop further reporting. Good for debugging, not if we are not
			// interested in spurious messages from weather stations, alarm systems and other 433 stuff
			// in the nabouthood.
			// XXX Careful, the check below is too simple to filter everything. binary_length != 12 or 32 or 36
			
			// If not a well-known message, discard it
			else if (xflg>0) {
				p_index = 0;
				header = 0;
				footer = 0;
				pulse_long = 0;
				stop_ints = 0;
				continue;
			}
			
			// Check? We need at least two identical codes 
			// For -1, One equal binary code extra needed
			// For -2 we will check 2 times
			// For -3 will make this 3 or more times!
			
			if ((cflg>0) && (binary_length > 0))	{
			
				// We check two or more codes with the binary, 
				// much easier than checking all non normalized
				is_eq = 1;
				for (i=0; i < binary_length; i++) { 
				
					if (checks == 0) { 
						chk_array[i] = binary[i]; 			// just copy
					}										
					else if (binary[i] != chk_array[i]) {
						is_eq = 0;
						break;
					}
				}
				if (is_eq == 0)	{							// NOT equal => reset counter and loop
					//printf("Check %d fail bit %d\n",checks,i);
					checks = 0;
					p_index = 0;
					header = 0;
					footer = 0;
					pulse_long = 0;
					stop_ints = 0;
					pulse_time = P_AUTO;				// Mwaaah
					continue;
				}
				else  
				if (checks < cflg) {
					// printf("Check %d success\n",checks);
					checks++;							// One extra check complete								
					p_index = 0;
					header = 0;
					footer = 0;
					pulse_long = 0;
					stop_ints = 0;
					continue;							// break to next loop, no printing further
				}
				
				// If is_eq == 1 and checks == cflg we continue here
				
			}// cflg
			checks = 0;
			
			printf("\n----- Results, checked %d times --------------------------------------------\n",cflg);
			
			if (verbose == 1) {
				printf("Timing code: <");
				for(i=0;i<p_length;i++) {
					printf("%d ",pulse_array[i]);
				}
				printf(">\n");
			}
				
			printf("Binary code: <");
				for(i=0;i<binary_length;i++) {
					printf("%d",binary[i]);
				}
				printf(">\n");
			
			
			//	------------------ PRINTING RESULTS ------------------------------
			// Now we have (optionally) checked the message, this must be a valid code for the remote/handset
			// We can now look at the low and high bits for this transmitter and determine the optimal value
			//
			if (verbose == 1) {
			
				printf("\n\n");

				if(normalize(header) == normalize(pulse_long)) {
					printf("header:\t\t0\n");
				} else {
					printf("header:\t\t%d,\t%d\n",header, normalize(header));
				}
				printf("pulse time:\t%d\n",pulse_time);			// XXX 
				printf("pulse_long:\t%d,\t%d\n",pulse_long, normalize(pulse_long));
				printf("footer:\t\t%d,\t%d\n",footer, normalize(footer));
				printf("p_length:\t%d\n",p_length);
				printf("binary_length:\t%d\n",binary_length);
				printf("stop_ints:\t%d\n",stop_ints);
				printf("\n");
				
				 
			}//if verbose
			
			// QQQ From here on, we work with data that is not influenced by interrupt handler anymore
			
			stop_ints=0;
			
			// If we recognize an impuls/Action message
			//
			if (binary_length == 12 ) {			
				
				address = 0; for (i=0; i<=4; i++) {
					address = address * 2;
					if (binary[i]==1) address += binary[i];
				}
				unit = 0; for (i=5; i<=9; i++) {			// Only the bitposition that is 0 is unit index, others float
					if (binary[i] == 0) {
						unit= i-5;
						continue;
					}
				}
				value = 0;
				if ((binary[10] == 0) && (binary[11]==2)) value = 0;		// Other bits are float
				else
				if ((binary[11] == 0) && (binary[10]==2)) value = 1;
				else 
				//
				// The following escapes below are for Chinese FOB that uses 2 encodings for a float!
				//
				if ((binary[10] == 0) && (binary[11]==3)) { value = 0; unit++; }
				else
				if ((binary[11] == 0) && (binary[10]==3)) { value = 1; unit++; }
				else value=-1;
				
				if ( (tflg>0) && (iflg>0) ) {
				
					p_short_cnt = 0;
					p_short_sum = 0;
					p_long_cnt = 0;
					p_long_sum = 0;
					p_long_min = 0;
					p_long_max = 0;
					p_short_min = 0;
					p_short_max = 0;
					
					// Skip header and footer bits 
					for (i=1; i<p_length-1; i++) {
						j = pulse_array[i];						// Store in tmp variable
						if (j < (2 * pulse_time)) {
							p_short_cnt++;
							p_short_sum += j;
							if ((j<p_short_min) || (p_short_min == 0)) p_short_min=j;
							if (j>p_short_max) p_short_max=j;
						}
						else {
							p_long_cnt++;
							p_long_sum += j;
							if ((j<p_long_min)||(p_long_min == 0)) p_long_min=j;
							if (j>p_long_max) p_long_max=j;
						}
					}
					a_short_cnt += p_short_cnt;
					a_short_sum += p_short_sum;
					a_long_cnt += p_long_cnt;
					a_long_sum += p_long_sum;
					if ((p_short_min < a_short_min) || (a_short_min == 0)) a_short_min=p_short_min;
					if (p_short_max > a_short_max) a_short_max=p_short_max;
					if ((p_long_min <a_long_min)||(a_long_min == 0)) a_long_min =p_long_min;
					if (p_long_max  > a_long_max)  a_long_max =p_long_max;
					
					printf(    "message count :\t\t%d\n", (int) ++socktcnt);
					printf(    "short pulses  :\t\t%d,\t\tthis:\t\t%d\n", (int) a_short_cnt,(int) p_short_cnt);
					if (p_short_cnt >0) 
						printf("short avg time:\t\t%d,\t\tthis:\t\t%d\n", (int)(a_short_sum/a_short_cnt),
																		  (int)(p_short_sum/p_short_cnt));
					else
						printf("short avg time:\t\t0\n");
					printf(    "Minimum short :\t\t%d,\t\tthis:\t\t%d\n", (int) a_short_min,(int) p_short_min);
					printf(    "Maximum short :\t\t%d,\t\tthis:\t\t%d\n", (int) a_short_max,(int) p_short_max);	
						
					printf(    "long  pulses  :\t\t%d,\t\tthis:\t\t%d\n", (int) a_long_cnt,(int) p_long_cnt);
					if (p_long_cnt >0)
						printf("long avg time :\t\t%d,\t\tthis:\t\t%d\n", (int)(a_long_sum/a_long_cnt),
																		  (int)(p_long_sum/p_long_cnt));
					else
						printf("long avg time :\t\t0");
					printf(    "Minimum long  :\t\t%d,\t\tthis:\t\t%d\n", (int) a_long_min,(int) p_long_min);
					printf(    "Maximum long  :\t\t%d,\t\tthis:\t\t%d\n", (int) a_long_max,(int) p_long_max);
				}
				
				printf("Found Action Switch: ");
				printf(" addr: %d, ",address);
				printf(" unit: %d",unit);
				printf(" value: %d ",value);
				printf ("\n------------------------------------------------------------------------\n");
			}
			else
			//
			// If we recognize a kaku command message, print it 
			// 
			if ((binary_length == 32 ) || (binary_length == 36)) {
						
				// bit 0 - 25: First 26 bits are address
				// bit     26: Group Bit
				// bit     27: on/off/dim bit
				// bit 28- 31: Unit Code
				// ** ONLY for dimmer in bit 27 **
				// bit 32- 36: dimmer value
				
				// Gather some more statistics for testing, specific for kaku
				// Use -k flag to gather these statistics. All values remain valid 
				// as long as the program runs
			
				if ( (tflg>0) && (kflg>0) ) {
				
					p_short_cnt = 0;
					p_short_sum = 0;
					p_long_cnt = 0;
					p_long_sum = 0;
					p_long_min = 0;
					p_long_max = 0;
					p_short_min = 0;
					p_short_max = 0;
					
					// Skip header and footer bits 
					for (i=2; i<p_length-1; i++) {
						j = pulse_array[i];
						if (j < (3 * pulse_time)) {
							p_short_cnt++;
							p_short_sum += j;
							if ((j<p_short_min) || (p_short_min == 0)) p_short_min=j;
							if (j>p_short_max) p_short_max=j;
						}
						else {
							p_long_cnt++;
							p_long_sum += j;
							if ((j<p_long_min)||(p_long_min == 0)) p_long_min=j;
							if (j>p_long_max) p_long_max=j;
						}
					}
					k_short_cnt += p_short_cnt;
					k_short_sum += p_short_sum;
					k_long_cnt += p_long_cnt;
					k_long_sum += p_long_sum;
					if ((p_short_min < k_short_min) || (k_short_min == 0)) k_short_min=p_short_min;
					if (p_short_max > k_short_max) k_short_max=p_short_max;
					if ((p_long_min <k_long_min)||(k_long_min == 0)) k_long_min =p_long_min;
					if (p_long_max  > k_long_max)  k_long_max =p_long_max;
					
					printf(    "message count :\t\t%d\n", (int) ++socktcnt);
					printf(    "short pulses  :\t\t%d,\t\tthis:\t\t%d\n", (int) k_short_cnt,(int) p_short_cnt);
					if (p_short_cnt >0) 
						printf("short avg time:\t\t%d,\t\tthis:\t\t%d\n", (int)(k_short_sum/k_short_cnt),
																		  (int)(p_short_sum/p_short_cnt));
					else
						printf("short avg time:\t\t0\n");
					printf(    "Minimum short :\t\t%d,\t\tthis:\t\t%d\n", (int) k_short_min,(int) p_short_min);
					printf(    "Maximum short :\t\t%d,\t\tthis:\t\t%d\n", (int) k_short_max,(int) p_short_max);	
					
					printf(    "long  pulses  :\t\t%d,\t\tthis:\t\t%d\n", (int) k_long_cnt,(int) p_long_cnt);
					if (p_long_cnt >0)
						printf("long avg time :\t\t%d,\t\tthis:\t\t%d\n", (int)(k_long_sum/k_long_cnt),
																		  (int)(p_long_sum/p_long_cnt));
					else
						printf("long avg time :\t\t0");
					printf(    "Minimum long  :\t\t%d,\t\tthis:\t\t%d\n", (int) k_long_min,(int) p_long_min);
					printf(    "Maximum long  :\t\t%d,\t\tthis:\t\t%d\n", (int) k_long_max,(int) p_long_max);
				}
			
				//
				// Do other Kaku output
				//
				address = 0; for (i=0; i<=25; i++) address = address * 2 + binary[i];
				unit = 0; for (i=28; i<=31; i++) unit = unit * 2 + binary[i];
									
				if (jflg == 1) {
					printf (" { ");
					printf("\"type\": \"switch\", ");
					printf ("\"address\": \"%d\", ",address);
					printf ("\"group\": \"%d\", ",binary[26]);
					printf ("\"status\": \"%d\", ",binary[27]);
					printf ("\"unit\": \"%d\"",unit);				/* remove trailing comma */
					if (binary_length == 36) {
						dimlevel = 0; for (i=32; i<=35; i++) dimlevel = dimlevel * 2 + binary[i];
						printf (", \"dim\": \"%d\"",dimlevel);		// add separation ","
					}
					printf (" } \n");
				}
				else {
					printf("Found Kaku Switch: ");
					printf(" addr: %d, ",address);
					printf(" group: %d ",binary[26]);
					printf(" on/off: %d ",binary[27]);
					printf(" unit: %d",unit);
					if (binary_length == 36) {
						dimlevel = 0; for (i=32; i<=35; i++) dimlevel = dimlevel * 2 + binary[i];
						printf(" dim: %d",dimlevel);
					}
					printf ("\n-------------------------------------------------------------------\n");
				}
			}
			fflush(stdout);
			
			// Now reset all variables for a next message
			
			header = 0;					// XXX For action stuff, footer is sync pulse (for next message)
			footer = 0;					// So we could copy this footer to new header
			pulse_long = 0;
			p_index = 0;
			stop_ints = 0;				// continue with interrupts
			pulse_time = P_AUTO;
			
		}// if message complete
		
	}// for;;;

	close(sockfd);
	exit (2);
}
