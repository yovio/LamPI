/*
  Copyright (c) 2013 Maarten Westenberg, mw12554@hotmail.com 
 
  This software is licensed under GNU license as detailed in the root directory
  of this distribution and on http://www.gnu.org/licenses/gpl.txt
 
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

#define SLEEP 50000								// Sleeptime uSec in daemon mode between two PING messages to LamPI-daemon
#define MILLIWAIT 60000							// 60 milli secs is  minute

#define PORT "5000" 							// the port client will be connecting to 

// Define TIming for Action
#define P_ACTION_SHORT	120

// Set the values for pulse_time. You are advised to take the value as lowest as possible for
// your use. If you want Kaku only, set it to 260, but if you use action set it to 200 or so.
// The last version of the receiver uses AUTO-discovery, if so choose P_AUTO higher (500).
//
#define P_AUTO	500								// Pulse time for Auto mode, must be little lower than pulse_long
#define P_ACTION 150							// Pulse time for Action/Impulse receivers
#define P_KAKU 260								// Pulse time for Kaku receivers

// Define Row Indexes for statistics ARRAY
// 	0=kaku, 1=action/impuls, 2=blokker, 3=kiku (=kaku old), 
//	4=elro, 5=livolo, 6=kopou
#define I_MAX_ROWS 10
#define I_KAKU 0
#define I_ACTION 1
#define I_BLOKKER  2
#define I_KIKU 3
#define I_ELRO 4
#define I_LIVOLO 5
#define I_KOPOU 6

// Define Columns Indexes for statistics
//	0=message_count, 1=pulse_count, 
//	2=pulses_short, 3=min_short, 4=avg_short, 5=max_short, 
//	6=pulses_long, 7=min_long, 8=avg_long, 9=max_long
#define I_MAX_COLS 13
#define I_MSGS 0
#define I_PULSES 1
#define I_CNT_SHORT 2
#define I_MIN_SHORT 3
#define I_AVG_SHORT 4
#define I_MAX_SHORT 5
#define I_SUM_SHORT 6
#define I_CNT_LONG 7
#define I_MIN_LONG 8
#define I_AVG_LONG 9
#define I_MAX_LONG 10
#define I_SUM_LONG 11


// Define Buffer Sizes
#define MAXDATASIZE 16384 						// max number of bytes we can get and store at once 
#define MAXMSGSIZE 256							// Max number of pulses in one message.

// External JSON functions in transmitter.c or cJSON.c
//
extern char * parse_cjson(cJSON *ptr, char * pattern);
extern int dtransmit(char *brand, char *gaddr, char *uaddr, char *val);
extern int daemon_mode(char *hostname, char* port);


// Cross declarations of functions
//
extern int open_socket(char *host, char *port);
extern int read_socket_and_transmit(int sockfd);

extern int verbose;
extern int debug;
extern int socktcnt;
extern int sockerr;
extern int sockfd;


#ifdef __cplusplus
}
#endif

#endif
