/*
 * snif_kopou.c:
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
 * snif_kopou.c:
 *
 * Functions to read Kopou receivers (and to test receiver codes)
 * The program is part of the LamPI-receiver daemon code and
 * received remote codes will be transmitted to a receiving socket of the 
 * LamPI-dameon daemon or in test mode be printed on the terminal.
 *
 * How to test:
 *
 * The following command will loop forever (takes 100% cpu) waiting
 * for compleed messages by the interrup handler and then show the 
 * result:
 * 	> sudo ./sniffer -t -v 
 *	
 *
 * The variable "stop_ints" is used to temp stop the handler from gathering
 * bits (interrupts occur but handler returns immediately)
 * This is to prevent reentrancy and corruption of main program results in testmode.
 * 
 *
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

#include "sniffer.h"

// The pulse_time is the most important parameter for the system to recognize messages
// For kaku we work with 260 uSec which works quite OK.
// For action switches the pulse time is more like 150 uSec. This means that if we want to see
// both messages we should adapt the pulse time, or widen the 30% bandwidth in the low_pass var in main init.
// As an experiment, we set this value to the last bit before a new header!

static int volatile pulse_time = P_AUTO;		// This is the initial lenght of the pulse
static int pulse_array [MAXDATASIZE];			// Array to store the pulse timing
static int p_min = 20;							// Min amount of pulses in message 8 == 2 bit (for action/impuls is 52)
static int p_short;
static int p_long;
static int p_head = 500;						// Min pulse time for header: for Kaku 2650, for Action 4660
static int p_footer = 3500;						// If larger than this value must be footer. For kaku
static int p_length=0;

static int binary    [MAXDATASIZE];				// Resulting bit stream
static int chk_array [MAXDATASIZE];				// For checking purposes
static int low_pass   = 80;						// Init so that min pulse_time - 30%  > low_pass

int socktcnt = 0;								// Message counter, used in sockets and in reporting

//	Global variable to count interrupts. 
//	These variable are shared between main prog and interrupt handler
//	Should be declared volatile to avoid compiler to cache it.

static volatile int p_index = 0;				// Counter of pulses in interrupt routine
static volatile int duration = 0;				// actual duration of this edge interrupt (3 x T)
static volatile int footer = 0;
static volatile int header = 500;
static volatile int stop_ints = 0;
static volatile int pulse_long = 300;

static volatile int dflg = 0;
static int cflg = 0;
static int aflg = 0;							// Auto flag, Catch All ...

int checks = 0;	


