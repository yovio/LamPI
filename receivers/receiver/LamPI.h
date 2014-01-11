/*
  Copyright (c) 2013 Maarten Westenberg
 
  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:
 
  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.
 
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  THE SOFTWARE.
*/

#ifndef LamPI__h
#define LamPI__h

#ifdef __cplusplus
extern "C"
{
#endif

#define SLEEP 30							// Sleeptime in daemon mode between two PING messages to LamPI-daemon
#define MAXDATASIZE	4096					// max number of bytes we can get at once

// External JSON functions in transmitter.c or cJSON.c
//
extern char * parse_cjson(cJSON *ptr, char * pattern);
extern int dtransmit(char *brand, char *gaddr, char *uaddr, char *val);
extern int daemon_mode(char *hostname, char* port);

// Cross declarations of functions
//
extern int open_socket(char *host, char *port);
//extern static int verbose;
extern int socktcnt;
extern int sockerr;


#ifdef __cplusplus
}
#endif

#endif
