Introduction LamPI
==================
This is the repository for LamPI, a RaspberryPI controller for 433MHz receivers.
(c) Maarten Westenberg (aka Platenspeler)
mw12554 @ hotmail.com

LamPI started as an alternative web front-end for the ICS-1000 controller of klikaanklikuit(.nl).
However, it has been extended with functionality to use a RaspberryPI with commodity transmitter/receiver and use that as a controller for klikaanklikuit receivers and other brand 433MHz receivers instead. 

Components:
===========
LamPI consists of a number of components that may or may not all be needed in order to get the  system running. Find more README.md files in the corresponding (sub)directories

1. The WebGUI; it is implemented by the LamPI-x.y.js file in the www directory
1b. I'm working on an Android version, which is almost ready for most functions.
	(coming soon in a theatre near you :-) )
2. The supporting backend_xxxxx.php  files in the www directory, for Java Calls

3. The LamPI-daemon.php daemon which is implemented in php. It needs the backend_cfg.php 
	file and the backend_lib.php file to work as wel as ...
4. The LamPI-receiver program, which implements the low-level Raspberry code for receiving
	and transmitting 433MHz messages from/to switches/dimmer/devices in your home
	The executable is found in the exe directory, the sources in receivers/receiver
5. Other executables (for each brand of device there is one), in the exe dir.
6. The front-end GUI and the LAMPI-daemon program need a MySQL database. This needs to 
	be setup according to www/backend_cfg.php file. However, the database itself may 
	reside on any other computer on the network as long as permissions are OK

Miscellaneous
-------------
7. The C and C++ sources files in receivers/<dir>. In those directories "make" will make the
	executable, "sudo make install" will install it in /home/pi/exe
8. A demo directory
9. A Compiled directory which contains compiled versions of the LamPI-x.y.js file 

Design:
=======
1. The MySQL database may be implemented on another computer than the Raspberry which 
	may be a safe choice (for backups etc. a NAS does well).
2. The www/LamPI-x.y.js GUI and the www/LamPI-daemon.php will in general be working on the 
	same machine which may or may not be a Raspberry.
3. The exe/LamPI-receiver (and transmitter) process will be running on Raspberry, but 
	probably with little effort can be made to run on Arduino too... 
	The supporting executables for 	devices need to be there as well (in exe directory)

Nov. 2013