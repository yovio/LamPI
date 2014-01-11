// LamPI, Javascript/jQuery GUI for controlling 434MHz devices (e.g. klikaanklikuit, action, alecto)
// Author: M. Westenberg (mw12554 @ hotmail.com)
// (c). M. Westenberg, all rights reserved
//
// Contributions:
//
// Version 1.6, Nov 10, 2013. Implemented connections, started with websockets option next (!) to .ajax calls.
// Version 1.7, Dec 10, 2013. Work on the mobile version of the program
//
// This is the code to animate the front-end of the application. The main screen is divided in 3 regions:
//

//
// Copyright, Use terms, Distribution etc.
// =========================================================================================
// This library is free software; you can redistribute it and/or
// modify it under the terms of the GNU Lesser General Public
// License as published by the Free Software Foundation; either
// version 2.1 of the License, or (at your option) any later version.
//
// This library is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
// Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public
// License along with this library; if not, write to the Free Software
// Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

//
// #gui_header: Here are the buttons for selecting the active rooms 
// #gui_content: The main screen where user can change the values of the active devices for the curently
//		active room. For the moment, the devices can have 2 types: switches and dimmers (see below)
// #gui_mssages: This is the area where the function message("text") will output its messages
// #gui_menu: This is the right side of the screen where we have the main menu where user can select the 
//		main activities: <home> <rooms> <scenes> <timers> <settings>
//
// Function init, Initialises variables as far as needed
// NOTE:: VAriables can be changed in the index.html file before calling start_LAMP
//
// DIV class="class_name"  corresponds to .class_name in CSS
// DIV id="id_name" corresponds to #id_name above
//

// DESIGN NOTES
//
// The Javascript file uses both the jQuery UI for the regular web based execution
// as well as the jQuery Mobile functions for Android/PhoneGAP.
// Unfortunately, widgets, functions etc differ between these two libraries (which is a SHAME).
// It is expected that jQueryUI and jQmobile will merge in next release.
// Therefore, I did not make separate files but one file with conditional execution of dialogs etc.
// Meanwhile, this file will support both libs for their separate purposes.


// ----------------------------------------------------------------------------
// SETTINGS!!!
// XXX: For adaptation to jqmobile changed all pathnames of backend to absolute URL's
//
var fake=0;													// Set to 1 if we fake communication 


//
// WebSocket definitions
//
var w_url = location.host; 									// URL of webserver
var w_svr = 'LamPI-daemon.php';								// webserver filename
var w_port = '5000'; 										// port
var w_uri;
var w_sock;
var w_tcnt =0;												// Transaction counter

// ----------------------------------------------------------------------------
// Mobile settings, used for Android or other jQueryMobile device
//
var phonegap=0;												// Standard setting, no phonegap
var jqmobile=0;												// This specifies what jQuery library fill be used
var murl='';

// ----------------------------------------------------------------------------
// 
//
var skin = "";
var debug = "1";										// debug is a level var. Higher values >0 means more debug
var persist = "1";										// Set default to relaxed
var mysql = "1";										// Default is using mySQL
var cntrl = "1";										// ICS-1000== 0 or Raspberry == 1

// ----------------------------------------------------------------------------
// s_STATE variables. They keep track of current room, scene and setting
// The s_screen variable is very important for interpreting the received messages
// of the server. 
// State changes of device values need be forwarded to the active screen
// IF the variable is diaplayed on the screen
//
var s_screen = 'room';									// Which screen is active: 1=room, 2=scene, 3=timer, 4=config
var s_controller = murl + 'backend_rasp.php';			// default device handles transmits to the lamps/devices
var s_room_id =1;										// Screen room_id
var s_scene_id =1;
var s_timer_id = 1;
var s_handset_id = 1;
var s_setting_id = "1";
var s_recorder = '';									// will make the recording of all user actions in a scene. 
var s_recording = 0;									// Set to 1 to record lamp commands

// -----------------------------------------------------------------------------
// Set limits for the program for using resources
//
var max_rooms = 16;										// Max nr of rooms. ICS-1000 has 8
var max_scenes = 16;									// max nr of scenes. ICS-1000 has 20
var max_devices = 16;									// max nr. of devices per room. ICS-1000 has 6
var max_timers = 16;
var max_handsets = 8;

// Actually, sum of timers and scenes <= 20 for ICS-1000

// The jSON data structure returned in the appmsg result from a "load" action
// containd 3 arrays. appmsg['rooms'] and appmsg['devices'] and appmsg['scenes'];
// The two vars below are loaded with the two sub-arrays.
// Up to 16 rooms and 16 devices (ASCII) can be used for the ICS-1000
//
// ROOMS
// rooms contains an array of key value pairs. Each key is a room id number, 
// and each value is a room name string.
// example: rooms[0]['id'] == 1 and rooms[0][''] == "living"


// DEVICES 
// The devices var contains the devices read during the init_dbase call
//
// SWITCHES
// Switches can be implemented straightforward by making two buttons for each lamp for OFF and ON.
// The value in the devices database is either 0 or 1 for switches
// We can use the value of the button to do further action.
//
// DIMMERS
// Dimmers are inplemented with slider elements. Sliders are an elegant way to select the value for
// a dimmed lamp. However, sliders do have a problem in jquery: They are created and destroyed but
// having more than one active on dynamic variables is difficult.
// We could start with the max of devices and create upfront so many sliders which we then bind
// based on their index on the screen to the element of our choice. This seems to be the best way, as
// it re-uses sliders (memory efficient) and gives us an easy way to read their values.
// In html: For each slider we need to set the class to .sliders and the index to id.
//
// SLIDERS (gui only)
// For buttons this is not necessary, but for sliders we may need to keep a shadow
// administration to handle declarations, bindings etc
// Each device object on screen is a <tr> row in a table
// First <td> cntains the device label, value="human device name",
// 		id="device id used by ICS-100, so D1-D16"
// Second <td> contains for switch the value="ON" and id="device id" 
//				Contains for dimmer the id="device_id"+"Fd" (dimmer), value updated by user
// Third <td> contains for switch the value=0 and id="device_id" 
//				Contains for dimmer the id="device_id"+"Fl" (label), value updated by jquery
//				Value is read by slider object, by converting the calling object id of the dimmer
//				in <td> 2 to the corresponding id of the label in the third <td>
//
// MOODS
// There are moods (related to rooms) and there are scenes. Moods are scenes without any timing set for 
// the individual device commands. For the moment we do support scenes and not yet moods (as we can model 
// them as scenes with a timer value of 0
//
// SCENES
// Scenes are a set of device commands that are recorded, given a name and then stored on the ICS-100 
// or on a webserver. The user can recall valid scenes and use them to apply a lighting scene 
// to his/her house. Individual commands in scenes are timed (in moods all device commands fire at once).
// Scenes are initially loaded by the functions init_dbase()
// The GUI allows for making a new scene or deleting or changing an exiting scene.
// There are a combined total of 32 timers and/or scenes allowed for the ICS-1000
// Scenes consist of a list of ICS commands with by timing records in between.
// commands, and timers are are comma separated 
// 
// The ICS 1000 stores the scene strings based on a scene name (!!!)
// In case of a store scene command, scnes with the same name are overwritten

//
// TIMERS
// Timers are a special kind of scenes. In fact, it is a scene with a timer attached to it. 
// It will make that the chain of device commands will start executing at some specified moment in time.
// Timers are quite complex, as we can program timer events in many, many ways
//
// SETTINGS
//
//
// BRANDS
//
//
// HANDSETS
//
var rooms={};
var devices={};
var moods={};
var scenes={};
var timers={};
var settings={};
var brands={};
var handsets={};

// ---------------------------------------------------------------------------------
//	This function waits until the document DOM is ready and then 
//	it listens for an event where the user presses a button.
//	Buttons are defined in separate functions based on their location in the document.
//	The code recognizes database and room initializations/bindings
//		and lamp commands
//  Make sure that buttons have an id(!!) and a name.
//	This function references by id, so that we can change the label code keeps working
//
function start_LAMP(){
//	
//  $(document).ready(function(){
  $(window).load(function(){

	// One of the difficult things here is the load_database function.
	// Several global variables such as devices and rooms are sized based on the data returned 
	// by the async AJAX call. As a result, you cannot!!!! rely on variables values as the functions 
	// may refer to these variables before load_database is finished.
	
	// If phonegap, make sure that we have  value for murl, in other words,
	// for the mobile app e need to know the ip or URL address of the server.
	// Function declarations and actions below are exclusive to phoneGap
	
	if ( jqmobile == 1 ) {
			
		if (phonegap == 1) {
			// Function below does not work correctly in combination with 
			// the $(window).load(function) above
			document.addEventListener("deviceready", onDeviceReady, false);
			document.addEventListener("online", onLine, false);
			onLinePopup();
		}	
		// Else we use the mobile libraries but NOT phonegap.
		else {
			onLinePopup();
		}
		// If we are here, we need to be sure that we have all parameters for networking etc.
	}
	
	
	// if not jqMobile: The solution is to start init_lamps, init_rooms and init_menu 
	// in the result function of the AJAX call in load_database
	// Upon success, we know that we have read the whole database.
	else {
		var ret = load_database("init");		// Initialise the database, this will give names to buttons
									// without the database being present, nothing will be displayed
		if (ret<0) {
			alert("Error:: loading database failed");
		}
		if ( (settings[1]['val'] == 1) && ( phonegap != 1 ) ) 				
		{
			init_websockets();			// For regular web based operations we start websockets here
		}
	}
	
	function onLine() {
			alert("onLine");
			//document.addEventListener("online", onLinePopup, false);
	}
	function onDeviceReady() {
			alert("onDeviceReady");
			//document.addEventListener("online", onLine, false);
	}
	
	// Below are the declarations/definitions of the callback functions init
	// These functions need to be defined only once, and will from that moment on be 
	// available once the conditions (mostly on click) are met
	// Some callback functions are still present in the activate_xxxxx functions,
	// such as sorting etc. but these can be moved over to this $(window).load() function later

//
// Handle the Header Room (HR) selection buttons
//
	$("#gui_header").on("click", ".hr_button", function(e){
			e.preventDefault();
//			e.stopPropagation();
			selected = $(this);
						
			value=$(this).val();								// Value of the button
			id = $(e.target).attr('id');						// should be id of the button (array index substract 1)
			$( '.hr_button' ).removeClass( 'hover' );
			$( this ).addClass ( 'hover' );
			activate_room(id);
	}); 
	
//	
// Handle Command Room (CR) buttons
//
	$("#gui_header").on("click", ".cr_button", function(e){
			e.preventDefault();
//			e.stopPropagation();
			selected = $(this);
			$( '.cr_button' ).removeClass( 'hover' );
			$( this ).addClass ( 'hover' );
			value=$(this).val();								// Value of the button
			id = $(e.target).attr('id');						// should be id of the button (array index substract 1)
			
			switch (id )
			{
			case "Add":											// Need to change to add a new room
				var ret;
				var new_room_id;
				var ind = 1;
				
				// Search for a roomid that is unused between 2 existing rooms
				// Look for matchins indexes. This is a time-exhausting operation, but only when adding a device
				while (ind <= max_rooms) { 
					for (var i=0; i< rooms.length; i++) {
						if ( ( rooms[i]['id'] == ind )) {		// We found this index is used!
							break; 								// for
						}
					}
					// If we are here, then we did not find device with id == "D"+ind
					// So the ind is unused, we use it
					if (i == rooms.length){
						
						break; // while
					}
					ind++;
				}
				// Now we have an index either empty slot in between room records, or append the current array
				if ( ind > max_rooms ) {
					alert("Unable to add more rooms");
					return(-1);
				}
				if (debug > 2) alert("Add Room: New index found: " + ind);
				
				// Now ask for a new for the new room
				// The for asks for 2 arguments, so maybe we need to make a change later
				// and make the function askForm more generic
				var frm='<form><fieldset>'
					+ '<p>You have created room nr ' + ind + '. Please specify name for your new room</p>'
					+ '<label for="val_1">Name: </label>'
					+ '<input type="text" name="val_1" id="val_1" value="" class="text ui-widget-content ui-corner-all" />'
					+ '</fieldset></form>';
				askForm(
					frm,
					// Create
					function (ret) {
						// OK Func, need to get the value of the parameters
						// Add the device to the array
						// SO what are the variables returned by the function???
						if (debug > 2) alert(" Dialog returned Name,Type: " + ret);		
							
						var newroom = {
							id: ind,
							name: ret[0]
						}
						rooms.push(newroom);			// Add record newdev to devices array
						s_room_id = ind;				// Make the new room the current room
						console.log(newroom);
						
						send_2_dbase("add_room", newroom);
						// And add the line to the #gui_devices section
						// Go to the new room
						// activate_room(new_room_id);
						// XXX Better would be just to add one more button and activate it in #gui_header !!
						init_rooms("init");
						return(1);	//return(1);
						
					// Cancel	
  					}, function () {
							activate_room (s_room_id);
						return(1); // Avoid further actions for these radio buttons 
  					},
  					'Confirm Create'
				); // askForm
			
				
			break;
			
			// Need this to delete a room
			case "Del":
			
				var list = [];
				var str = '<label for="val_1">Delete Room: </label>'
						+ '<select id="val_1" value="val_1" >' ;   // onchange="choice()"
					
				// Allow selection, but first let the user make a choice
				for (i=0; i< rooms.length; i++) {
					str += '<option>' + rooms[i]["name"] + '</option>';
				}
				str += '</select>';
				
				// The form returns 2 arguments, we only need the 1st one now
				var frm='<form><fieldset>'
					+ '<br />You are planning to delete a room from the system. If you do so, all actions '
					+ 'associated with the room must be deleted too.\n'
					+ 'Please start with selecting a room from the list on top of the screen.'
					+ 'Please click on the room you wish to delete from the system.<br /><br />'
					+ str
					+ '<br />'
					+ '</fieldset></form>';
					
				askForm(
					frm,
					// Create
					function (ret) {							// ret value is an array of return values
						// OK Func, need to get the value of the parameters
						if (debug > 2) alert(" Dialog returned val_1,val_2: " + ret);		
						var rname = ret[0];
						
						for (var i=0; i< rooms.length; i++) {
								if (rooms[i]['name'] == rname) {
									break;
								}
						}
						// Is the room empty?
						var room_id = rooms[i]['id'];
						for (var j=0; j< devices.length; j++) {
							if ( devices[j]['room'] == room_id ) {
								alert("Room " + rname + " is not empty\nWe cannot delete this room\nSorry");
								return(0);
							}
						}
						
						// Remove the room from the array. removed is array of removed array elements
						var removed = rooms.splice(i ,1);		
						// If we deleted the current room, maake the current room the first room in array
						if (s_room_id == room_id) s_room_id = rooms[0]['id'];
						if ( persist > 0 ) {
							console.log(removed[0]);
							// Remove the room from MySQL
							send_2_dbase("delete_room", removed[0]);
							if (debug>1)
								alert("Removed from dbase:: id: " + removed[0]['id'] + " , name: " + removed[0]['name']);
						}
						
						// 
						init_rooms("init");						// As we do not know which room will be first now
						return(1);	//return(1);
						
					// Cancel	
  					}, function () {
							activate_room (s_room_id);
						return(1); // Avoid further actions for these radio buttons 
  					},
  					'Confirm Delete Room'
				); // askForm
	
				
				// Popup: Are you sure? If Yes: delete row
				// Are we sure that all devices in the room are deleted as well?
				
			break;
			
			case "Help":
			// Help
			
				// XXX Change the alert for a better dialog solution
				alert("This form allows you to control the lighting in a particular room " 
					  + "Select the room that you like to control with the buttons in the top header area " 
					  + "For every device in the room, whether dimmer or switch, users can change the light "
					  + "setting.\n"
					  + "The small buttons in the top right corner are special buttons "
					  + "The leftmost green one allows you to add a device to the active room.\n"
					  + "The red X allows you to delete a device from the room. Press the X and you'll see "
					  + "small selection buttons on the left of every device line. Press one and you'll "
					  + "be able to delete the device"
					  );
				$( '.cr_button' ).removeClass( 'hover' );
			break;
			
			}
	});
	
// SCENE	
// *** Handle the Header Scene buttons
//
	$("#gui_header").on("click", ".hs_button", function(e){
		e.preventDefault();
//		e.stopPropagation();
		selected = $(this);
		$( '.hs_button' ).removeClass( 'hover' );
		$( this ).addClass ( 'hover' );
		value=$(this).val();								// Value of the button
		id = $(e.target).attr('id');						// should be id of the button (array index substract 1)
		activate_scene(id);
	}); 

// SCENE
//	*** Handle the Command Scene (CS) buttons (add, delete, help)
//
	$("#gui_header").on("click", ".cs_button", function(e){
		e.preventDefault();
//		e.stopPropagation();
		selected = $(this);
		$( '.cs_button' ).removeClass( 'hover' );
		$( this ).addClass ( 'hover' );
		value=$(this).val();								// Value of the button
		id = $(e.target).attr('id');						// should be id of the button (array index substract 1)
		switch (id)
		{	// Add a new scene. So we have to record a sequence
			case "Add":
				// We start with making a new row in the scene array,
				// give it a name etc.
				// Then we need to transfer control to the user
				// Find a free scene id:
				var ind = 1;
				
				// Search for a sceneid that is unused between 2 existing scenes
				// Look for matchins indexes. This is a time-exhausting operation, but only when adding a scene
				while (ind <= max_scenes) { 
					for (var i=0; i< scenes.length; i++) {
						if ( ( scenes[i]['id'] == ind )) {
						// alert("found this ind: "+ind+" on pos "+i+", );
						// We found this index is used!
							break; // for
						} // if
					} // for
					// If we are here, then we did not find scnene id equal to ind 
					// So the ind is unused, we use it
					if (i == scenes.length){
						break; // while
					}
					ind++;
				}//while
				// Now we have an index either empty slot in between scene records, or append the current array
				if ( ind > max_scenes ) {
					alert("Unable to add more scenes");
					return(-1);
				}
					
				// Now ask for a name for the new scene
				// The for asks for 2 arguments, so maybe we need to make a change later
				// and make the function askForm more generic
				var frm='<form><fieldset>'
					+ '<p>You have created scene nr ' + ind + '. Please specify name for your new scene</p>' 
					//+ '<p>You have created a new scene. Please specify name for your new scene</p>'
					+ '<label for="val_1">Name: </label>'
					+ '<input type="text" name="val_1" id="val_1" value="" class="text ui-widget-content ui-corner-all" />'
					+ '<br />'
					// XXX so leave this in just for the moment 
					//+ '<label for="type">Type: </label>'
					//+ '<input type="text" name="type" id="type" value="" class="text ui-widget-content ui-corner-all" />'
					+ '</fieldset></form>';
					
				askForm(
					frm,
					// Create
					function (ret) {
						// OK Func, need to get the value of the parameters
						// Add the device to the array
						// So what are the variables returned by the function???
						if (debug > 2) alert(" Dialog returned val_1,val_2: " + ret);		
							
						var newscene = {
							id: ind,
							name: ret[0],
							val: "OFF",
							seq: ""						// we should start with empty Scene
						}
						scenes.push(newscene);			// Add record newdev to devices array
						// console.log(newscene);
						send_2_dbase("add_scene", newscene);
						// And add the line to the #gui_devices section
						// Go to the new scene
						s_scene_id = ind;
						// activate_scene(new_scene_id);
						// XXX Better would be just to add one more button and activate it in #gui_header !!
						init_scenes("init");
						return(1);	//return(1);
						
					// Cancel	
  					}, function () {
							activate_scene (s_scene_id);
						return(1); // Avoid further actions for these radio buttons 
  					},
  					'Confirm Create'
				); // askForm
				
			break;
				
			// Remove the current scene. Means: Remove from the scenes
			// array, and reshuffle the array. 
			// What it means for SQL need to sort out later .....
			case "Del":
				
				var list = [];
				var str = '<label for="val_1">Delete Scene: </label>'
						+ '<select id="val_1" value="val_1" >' ;   // onchange="choice()"
					
				// Allow selection, but first let the user make a choice
				for (i=0; i< scenes.length; i++) {
					str += '<option>' + scenes[i]["name"] + '</option>';
				}
				str += '</select>';
				
				// The form returns 2 arguments, we only need the 1st one now
				var frm='<form><fieldset>'
					+ '<br />You are planning to delete a scene from the system. If you do so, all actions '
					+ 'associated with the scene must be deleted too.\n'
					+ 'Please start with selecting a scene from the list.<br /><br />'
					+ str
					+ '<br />'
					+ '</fieldset></form>';
					
				askForm(
					frm,
					// Create
					function (ret) {							// ret value is an array of return values
						// OK Func, need to get the value of the parameters
						if (debug > 2) alert(" Dialog returned val_1,val_2: " + ret);		
						var sname = ret[0];
						
						for (var i=0; i< scenes.length; i++) {
								if (scenes[i]['name'] == sname) {
									break;
								}
						}
						// Is the room empty? Maybe we do not care, everything for scene is IN the record itself
						var scene_id = scenes[i]['id'];
						
						// Remove the scene from the array
						var removed = scenes.splice(i ,1);		// Removed is an array too, one element only
						
						if ( persist > 0 ) {
							console.log(removed[0]);
							// Remove the room from MySQL
							send_2_dbase("delete_scene", removed[0]);
							if (debug>1)
								alert("Removed from dbase:: id: " + removed[0]['id'] + " , name: " + removed[0]['name']);
						}
						
						// 
						s_scene_id = scenes[0]['id'];				// If there are no scenes, we are in trouble I guess
						init_scenes("init");						// As we do not know which room will be first now
						return(1);	//return(1);
						
					// Cancel	
  					}, function () {
							activate_scene (s_scene_id);
						return(1); // Avoid further actions for these radio buttons 
  					},
  					'Confirm Delete Scene'
				); // askForm
					

				// Popup: Are you sure?
				
				// If Yes: delete row

			break;
				
				//
				// Help for Scene setting
				//
			case "Help":
					alert("This is the Help screen for Scenes (or sequences if you wish)\n\n"
						+ "In the header section you see an overview of your scenes defined, "
						+ "which enables you to view/change or add to a scene of your choice. \n\n"
						+ "The Context section in the middle shows for each defines scene the sequence "
						+ "of actions that will be performed when you RUN that scene with the blue > button. \n"
						+ "If you add or remove a device action to a scene this will NOT be stored unless you "
						+ "use the store function which will write the sequence to the database. "
						);
					$( '.cs_button' ).removeClass( 'hover' );
			break;
				
			default:
					alert("Error:: click id " + id + " not recognized");
			}
		
			
// Sortable Gui_header on tbody

		// Make the room header table sortable. It allows us to define a table with buttons above that are 
		// Not sortable but still look quite the same as these ... And for button handling it does
		// not see the difference.
		if (jqmobile == 1) {							// Sortable works different for jqmobile, do later
		
			// **** SORTABLE NOT IMPLEMENTED FOR JQMOBILE ***
		
		}
		else 
		{										// jQuery UI Sortable
		  $("#gui_header tbody").sortable({

			start: function (event, ui) {
            	$(ui.item).data("startindex", ui.item.index());
        	},
			// NOTE: index 0 contains the header and is undefined, DO NOT USE IT
			stop: function (event, ui) {
				var mylist;
				// Go over each element and record the id
				$( "#gui_devices tr" ).each(function( index ) {
					if ( index != 0) {
						console.log( index + ": " + $(this ).children().children('.dlabels').attr('id') );
						// ---YYY--
						// problem is that we have to change the order in the database
						// whereas you're never sure which record will be fetched first
					}
					else {
						console.log( index + ": " + "Header" );
					}
				}); // each
            	//self.sendUpdatedIndex(ui.item);
        	}//stop function	 
		  }).disableSelection();
		}//else
	
	}); // Handler
	
// TIMER
// ** HANDLER FOR HEADER TIMER BUTTONS	
	
	$("#gui_header").on("click", ".ht_button", function(e){
			e.preventDefault();
//			e.stopPropagation();
			selected = $(this);
			$( '.ht_button' ).removeClass( 'hover' );
			$( this ).addClass ( 'hover' );
			value=$(this).val();								// Value of the button
			id = $(e.target).attr('id');						// should be id of the button (array index substract 1)
			activate_timer(id);
			if (debug > 2) alert("init_timer:: Button event");
	}); 	

// TIMER
// ** HANDLER FOR CONTROL TIMER BUTTONS	
		
	$("#gui_header").on("click", ".ct_button", function(e){
		e.preventDefault();
//		e.stopPropagation();
		selected = $(this);
		$( '.cs_button' ).removeClass( 'hover' );
		$( this ).addClass ( 'hover' );
		value=$(this).val();								// Value of the button
		id = $(e.target).attr('id');						// should be id of the button (array index substract 1)
		switch (id)
		{	
			// Add a new timer. So we have to record a sequence
			case "Add":
				// We start with making a new row in the timer array, give it a name etc.
				// Then we need to transfer control to the user
				
				// Find a free timer id:
				var ind = 1;
			
				// Search for a timerid that is unused between 2 existing timer records
				// Look for matchins indexes. This is a time-exhausting operation, but only when adding a timer
				while (ind <= max_timers) { 
					for (var i=0; i< timers.length; i++) {
						if ( ( timers[i]['id'] == ind )) {
						// alert("found this ind: "+ind+" on pos "+i+", );
						// We found this index is used!
							break; // for
						} // if
					} // for
					// If we are here, then we did not find timer with ind 
					// So the ind is unused, we use it
					if (i == timers.length){
						break; // while
					}
					ind++;
				}//while
				// Now we have an index either empty slot in between timer records, or append the current array
				if ( ind > max_timers ) {
					alert("Unable to add more timers");
					return(-1);
				}
					
				// Now ask for a name for the new timer
				// The for asks for 2 arguments, so maybe we need to make a change later
				// and make the function askForm more generic
				var frm='<form><fieldset>'
					+ '<p>You have created timer nr' + ind + '. Please specify name for your new timer</p>' 
					+ '<label for="val_1">Name: </label>'
					+ '<input type="text" name="val_1" id="val_1" value="" class="text ui-widget-content ui-corner-all" />'
					+ '<br />'
					// XXX so leave this in just for the moment 
					//+ '<label for="val_2">Type: </label>'
					//+ '<input type="text" name="val_2" id="val_2" value="" class="text ui-widget-content ui-corner-all" />'
					+ '</fieldset></form>';
					
				askForm(
					frm,
					// Create
					function (ret) {
						// OK Func, need to get the value of the parameters
						// Add the timer to the array
						// So what are the variables returned by the function???
						if (debug > 2) alert(" Dialog returned val_1,val_2: " + ret);		
							
						var newtimer = {
							id: ind,
							name: ret[0],
							scene: "",
							tstart: "00:00:00",
							startd: "01/01/13",
							endd: "",
							days: "mtwtfss",
							months: "jfmamjjasond"
						}
						timers.push(newtimer);			// Add record newdev to devices array

						send_2_dbase("add_timer", newtimer);
						// And add the line to the #gui_devices section
						// Go to the new timer
						// XXX Better would be just to add one more button and activate it in #gui_header !!
						init_timers("init");
						return(1);	
						
					// Cancel	
  					}, function () {
							activate_timer (s_timer_id);
						return(1); 					// Avoid further actions for these radio buttons 
  					},
  					'Confirm Create'
				); // askForm
					
			break;
				
			// Remove the current timer. Means: Remove from the timers array
			// and reshuffle the array. 
			// What it means for SQL need to sort out later .....
			case "Del":
				
				var list = [];
				var str = '<label for="val_1">Delete Timer: </label>'
					+ '<select id="val_1" value="val_1" >' ;   // onchange="choice()"
				
				// Allow selection, but first let the user make a choice
				for (i=0; i< timers.length; i++) {
					str += '<option>' + timers[i]["name"] + '</option>';
				}
				str += '</select>';
			
				// The form returns 2 arguments, we only need the 1st one now
				var frm='<form><fieldset>'
					+ '<br />You are planning to delete a timer from the system. If you do so, all actions '
					+ 'associated with the timer are deleted too.\n'
					+ 'Please start with selecting a timer from the list.<br /><br />'
					+ str
					+ '<br />'
					+ '</fieldset></form>';
				askForm(
					frm,
					// Create
					function (ret) {							// ret value is an array of return values
						// OK Func, need to get the value of the parameters
						if (debug > 2) alert(" Dialog returned val_1,val_2: " + ret);		
						var tname = ret[0];
						
						for (var i=0; i< timers.length; i++) {
							if (timers[i]['name'] == tname) {
								break;
							}
						}
						// Is the room empty? Maybe we do not care, everything for scene is IN the record itself
						var timer_id = timers[i]['id'];
					
						// Remove the timer from the array
						var removed = timers.splice(i ,1);		// Removed is an array too, one element only
					
						if ( persist > 0 ) {
							console.log(removed[0]);
							// Remove the timer from MySQL
							send_2_dbase("delete_timer", removed[0]);
							if (debug>1)
								alert("Removed from dbase:: id: " + removed[0]['id'] + " , name: " + removed[0]['name']);
						}
						
						// 
						init_timers("init");					// As we do not know which timer will be first now
						return(1);	//return(1);
					
					// Cancel	
  					}, function () {
						activate_timer (s_timer_id);
						return(1); // Avoid further actions 
  					},
  					'Confirm Delete Timer'
				); // askForm
					
				// Popup: Are you sure
			break;
				
				//
				// Help for Timer setting
				//
			case "Help":
					alert("This is the Help screen for Timers\n\n"
						+ "In the header section you see an overview of your timers defined, "
						+ "selecting one enables you to view/change or add to a timer. \n\n"
						+ "The Content section in the middle shows its settings: Which scene should be started, "
						+ "on what time, and on whichs days or months. \n"
						+ "If you change a timer setting this will NOT be stored unless you "
						+ "use the store function which will write the timer to the database. "
						);
					$( '.ct_button' ).removeClass( 'hover' );
			break;
				
			default:
					alert("Error:: click id " + id + " not recognized");
		} // switch
		
	});	// CT Timer Handler



// HANDSET
// Handle the Header Handset (=remote) selection buttons
// This function deals with the handset buttons diaplayed in the header section.
// If the user selects one of these buttons, the corresponding handset screen is activated.
//
	$("#gui_header").on("click", ".hh_button", function(e){
			e.preventDefault();
//			e.stopPropagation();
			selected = $(this);
						
			value=$(this).val();								// Value of the button
			id = $(e.target).attr('id');						// should be id of the button (array index substract 1)
			$( '.hh_button' ).removeClass( 'hover' );
			$( this ).addClass ( 'hover' );
			activate_handset(id);
	}); 




// HANDSET
//	*** Handle the Command Handset (CH) buttons (add, delete, help)
// This function implements the small action buttons (add, delete, help) in the upper right corner
// of the screen.
//
	$("#gui_header").on("click", ".ch_button", function(e){
		e.preventDefault();
//		e.stopPropagation();
		selected = $(this);
		$( '.cs_button' ).removeClass( 'hover' );
		$( this ).addClass ( 'hover' );
		value=$(this).val();								// Value of the button
		id = $(e.target).attr('id');						// should be id of the button (array index substract 1)
		switch (id)
		{	
			// Add a new handset. 
			case "Add":
				// We start with making a new row in the handset array,
				// give it a name etc.
				// Then we need to transfer control to the user
				// Find a free handset id:
				
				// Search for a handset id that is unused in array of existing handsets
				// Look for matching indexes. This is a time-exhausting operation, but only when adding a handset
				var ind = 1;
				while (ind <= max_handsets) { 
					for (var i=0; i< handsets.length; i++) {
						if ( ( handsets[i]['id'] == ind )) {
						// alert("found this ind: "+ind+" on pos "+i+", );
						// We found this index is used!
							break; // for
						} // if
					} // for
					// If we are here, then we did not find handset id equal to ind 
					// So the ind is unused, its free for us to use it
					if (i == handsets.length){
						break; // while
					}
					ind++;
				}//while
				
				// Now we have an index either empty slot in between scene records, or append the current array
				if ( ind > max_handsets ) {
					alert("Unable to add more handsets");
					return(-1);
				}
// QQQ
				// Now ask for a name for the new handset
				// The for asks for 2 arguments, so maybe we need to make a change later
				var frm='<form><fieldset>'
					+ '<br />DRAFT:'
					+ '<p>You have created handset nr ' + ind + '. Please specify name for your new remote</p>' 
					+ '<label for="val_1">Name: </label>'
					+ '<input type="text" name="val_1" id="val_1" value="" class="text ui-widget-content ui-corner-all" />'
					+ '<br /><br />'
					+ '<label for="val_2">Address: </label>'
					+ '<input type="text" name="val_2" id="val_2" value="" class="text ui-widget-content ui-corner-all" />'
					+ '<br />'
					+ '</fieldset></form>';
					
				askForm(
					frm,
					// Create
					function (ret) {
						// OK Func, need to get the value of the parameters
						// Add the device to the array
						// So what are the variables returned by the function???
						if (debug > 2) alert(" Dialog returned val_1,val_2: " + ret);
						var handset_name = ret[0];
						var handset_addr = ret[1];
						for (var i=0; i< handsets.length; i++) {
							if (handsets[i]['addr']==handset_addr) {
								break;
							}
						}
						if (i!=handsets.length){
							alert("The handset address "+handset_addr+" is already registered");
							return(0);
						}
						if (debug>1) alert("New handset on ind: "+ind+", name: "+handset_name+", addr: "+handset_addr);
						var newhandset = {
							id: ind,
							name: handset_name,
							brand: "",
							addr: handset_addr,
							unit: "0",
							val: "0",
							type: "switch",
							scene: ""						// we should start with empty Scene
						}
						handsets.push(newhandset);			// Add record newdev to devices array
						console.log("Added new handset "+newhandset['name']);
						send_2_dbase("add_handset", newhandset);
						// And add the line to the #gui_devices section
						// Go to the new scene
						s_handset_id = ind;
						// activate_handset(new_hndset_id);
						// XXX Better would be just to add one more button and activate it in #gui_header !!
						init_handsets("init");
						return(1);	//return(1);
						
					// Cancel	
  					}, function () {
							activate_handset (s_handset_id);
						return(1); // Avoid further actions for these radio buttons 
  					},
  					'Confirm Create'
				); // askForm
				
			break;
				
			// Remove the current scene. Means: Remove from the scenes
			// array, and reshuffle the array. 
			// As there are multiple records with the same id, we need to make a 
			// list first, and after selection delete all records with that id.
			//
			// What it means for SQL need to sort out later .....
			case "Del":
				
				var list = [];
				var str = '<label for="val_1">Delete Handset: </label>'
						+ '<select id="val_1" value="val_1" >' ;   // onchange="choice()"
				
				// Allow selection, but first let the user make a choice
				// Make sure every name only appears once
				var hset_list=[];
				for (i=0; i< handsets.length; i++) {
					if ( $.inArray(handsets[i]['id'],hset_list) == -1) {
						str += '<option>' + handsets[i]["name"] + '</option>';
						hset_list[hset_list.length]= handsets[i]['id'];
					}
				}
				str += '</select>';
				
				// The form returns 2 arguments, we only need the 1st one now
				var frm='<form><fieldset>'
					+ '<br>DRAFT:</br>'
					+ '<br />You are planning to delete a handset from the system. If you do so, all actions '
					+ 'associated with the handset must be deleted too.\n'
					+ 'Please start with selecting a handset from the list.<br /><br />'
					+ str
					+ '<br />'
					+ '</fieldset></form>';
					
				askForm(
					frm,
					// Create
					function (ret) {							// ret value is an array of return values
						// OK Func, need to get the value of the parameters
						if (debug>2) alert(" Dialog returned val_1,val_2: "+ret);		
						var sname = ret[0];
						
						// There might be more than one record with the same id
						// We work our way back in the array, so index i remains consistent
						for (var i=handsets.length-1; i>=0; i--) {
							if (debug>2) alert("working with i: "+i+", handset id: "+handsets[i]['name']);
							if (handsets[i]['name'] == sname) {
								// Is the room empty? Maybe we do not care, 
								//everything for scene is IN the record itself
								var handset_id = handsets[i]['id'];
								// Removed is an array too, one element only
								var removed = handsets.splice(i ,1);
								if ( persist > 0 ) {
									console.log(removed[0]);
									// Remove the room from MySQL
									send_2_dbase("delete_handset", removed[0]);
									if (debug>1)
										myAlert("Removed from dbase:: id: "+removed[0]['id']+" , name: "+removed[0]['name']);
								}
							}
						}
						
						// As we do not know which room will be first now
						// If there are no handsets, we are in trouble I guess
						s_handset_id = handsets[0]['id'];
						init_handsets("init");
						return(1);						
					// Cancel	
  					}, function () {
							activate_handset (s_handset_id);
						return(1); // Avoid further actions for these radio buttons 
  					},
  					'Confirm Delete Handset'
				); // askForm
				// Popup: Are you sure?
				
				// If Yes: delete row
			break;
				
				//
				// Help for Scene setting
				//
			case "Help":
					alert("This is the Help screen for Handsets or Remote controls\n\n"
						+ "In the header section you see an overview of your handsets defined, "
						+ "which enables you to view/change or add to a handset of your choice. \n\n"
						+ "The Content section in the middle shows for each defined handset the button "
						+ "definitions"
					
						+ "If you add or remove a device action to a handset these will NOT be stored unless you "
						+ "use the store function which will write the sequence to the database. "
						);
					$( '.ch_button' ).removeClass( 'hover' );
			break;
				
			default:
					alert("Error:: click id " + id + " not recognized");
			}
		
			
// Sortable Gui_header on tbody

		// Make the handset header table sortable. It allows us to define a table with buttons above that are 
		// Not sortable but still look quite the same as these ... And for button handling it does
		// not see the difference.
		if (jqmobile == 1) {							// Sortable works different for jqmobile, do later
		
			// **** SORTABLE NOT IMPLEMENTED FOR JQMOBILE ***
		
		}
		else 
		{										// jQuery UI Sortable
		  $("#gui_header tbody").sortable({

			start: function (event, ui) {
            	$(ui.item).data("startindex", ui.item.index());
        	},
			// NOTE: index 0 contains the header and is undefined, DO NOT USE IT
			stop: function (event, ui) {
				var mylist;
				// Go over each element and record the id
				$( "#gui_devices tr" ).each(function( index ) {
					if ( index != 0) {
						console.log( index + ": " + $(this ).children().children('.dlabels').attr('id') );
						// ---YYY--
						// problem is that we have to change the order in the database
						// whereas you're never sure which record will be fetched first
					}
					else {
						console.log( index + ": " + "Header" );
					}
				}); // each
            	//self.sendUpdatedIndex(ui.item);
        	}//stop function	 
		  }).disableSelection();
		}//else
	
	}); // Handler for remotes handsets




// CONFIG
// ** HANDLER FOR HEADER CONFIG BUTTONS

	$("#gui_header").on("click", ".hc_button", function(e){
			e.preventDefault();
//			e.stopPropagation();
			selected = $(this);
			
			$( '.hc_button' ).removeClass( 'hover' );
			$( this ).addClass ( 'hover' );	
			
			value=$(this).val();								// Value of the button
			id = $(e.target).attr('id');						// should be id of the button (array index substract 1)
			activate_setting(id);
//			alert("init_settings:: Button event");
		});

// CONFIG
// ** HANDLER FOR CONTROL CONFIG BUTTONS	
		
	$("#gui_header").on("click", ".cc_button", function(e){
		e.preventDefault();
//		e.stopPropagation();
		selected = $(this);
		$( '.cc_button' ).removeClass( 'hover' );
		$( this ).addClass ( 'hover' );
		value=$(this).val();								// Value of the button
		id = $(e.target).attr('id');						// should be id of the button (array index substract 1)
		switch (id)
		{	
			// Add a new configuration. This is NOT applicable to config at the moment
			case "Add":
				// We start with making a new row in the setting array,
				// give it a name etc.
				// Then we need to transfer control to the user
				alert("Add a Setting");	
				// Find a free scene id:
				var ind = 1;
				
			break;
				
			// Remove the current scene. Means: Remove from the scenes
			// array, and reshuffle the array. 
			// What it means for SQL need to sort out later .....
			case "Del":

			break;
				//
				// Help for Timer setting. XXX May have to add this one
				//
			case "Help":
					alert("This is the Help screen for Setting Configuration\n\n"
						+ "In the header section you see buttons to select a configuration item, "
						+ "each one will show a form where you can change certain settings. "
						);
					$( '.cc_button' ).removeClass( 'hover' );
			break;
				
			default:
					alert("Error:: click id " + id + " not recognized");
		} // switch
		
	});	// CC Config Handler
	
// ----------------------------------------------------------------------------------------
//	Init websockets communication
//	Especially the handlers for websockets etc,
//
	
function init_websockets() {
	// ** These are the handlers for websocket communication.
	// ** We only use either websockets or regular/normal sockets called by .ajax/php handlers
	// ** User can specify/force bahaviour by setting a variable
	// 
	// Controller must be Raspberry for websockets to work
	// Also, phonegap does not yet (!) support websockets for older Android phones
	//
	//if ( (settings[1]['val'] == 1) && ( phonegap != 1 ) ) 				
	//{
		// Make a new connection and start registering the various actions,
		// State 0: Not ready
		// State 1: Ready
		// State 2: Close in progress
		// State 3: Closed
		
		w_uri = "ws://"+w_url+":"+w_port;
		w_sock = new WebSocket(w_uri);
		
		w_sock.onopen = function(ev) { 							// connection is open 
			console.log("Websocket:: Opening socket "+w_uri);	// notify user
		};
		w_sock.onclose	= function(ev){
			console.log("Websocket:: socket closed, reopening socket "+w_uri);
			w_sock = new WebSocket(w_uri);
		};
		w_sock.onerror	= function(ev){
			var state = w_sock.readyState;
			console.log("Websocket:: error. State is: "+state);
			message("websocket:: error: "+state,1);
		};
		w_sock.onmessage = function(ev) {
			var ff = ev.data.substr(1);
			//alert("Websocket:: Received a Message: "+ff);
			//console.log("Websocket:: message");
			
			var rcv = JSON.parse(ev.data);		//PHP sends Json data
			// First level of the json message
			var tcnt   = rcv.tcnt; 				//message transaction counter
			var type   = rcv.type;				// type, eg raw
			var action = rcv.action; 			//message text
			var gaddr  = rcv.gaddr;				// Group address of the receiver
			var uaddr  = rcv.uaddr;				// Unit address of the receiver device
			// var val   = rcv.val;
			var brand  = rcv.brand;				// Brand of the receiver device
			var msg    = rcv.message;			// The message in ICS format e.g. "!RxDyFz"
			
			// Now we need to parse the message and take action.
			// Best is to build a separate parse function for messages
			// and route them to the approtiate screen
			switch (action) {
				// ack messages ae just confirmations and may be further discarded
				case "ack":
					if (debug>1) {
						message("action: "+action+", tcnt: "+tcnt+", mes: "+msg+", type: "+type);
					}
					else {
						console.log("action: "+action+", tcnt: "+tcnt+", mes: "+msg+", type: "+type);
					}
				break;
				
				// Update messages can contain updates of devices, scenes, timers or settings.
				// And this is list is sorted on urgency as well. changes in device values need to be
				// reflected on the dashboard immediately.
				// Changes in settings are less urgent and frequent
				case "upd":
					message("action: "+action+", tcnt: "+tcnt+", mes: "+msg+", type: "+type);
					// if message is coded in json, first decode into json structure
					switch (type) {
						case 'json': 
							console.log("onmessage:: read upd message. Type is: "+type+". Json is not supported yet");
						break;
						case 'raw':
							console.log("onmessage:: read upd message. Type is: "+type);	
						break;
						default: 
							console.log("onmessage:: read upd message. Unknown type: "+type);
					}
					var pars = parse_int(msg);			// Split into array of integers
														// This function works for normal switches AND dimmers
														// Only for dimmers string is longer !RxxDxxFdPxx
					
					// As we receive updates for devices
					if ( msg.substr(0,2) == "!R" ){
						var room = pars[0];
						var device = pars[1];
						
						// Now we need to check if it's a dim or F1 command. If dim
						// we need not use value 1 but last used value in devices!
						// XXX
						var val;
						if (msg.search("FdP") > -1) {
							val = pars[2];
						}
						else {
							val = pars[2];
						}
						
						var ind = find_device(room, "D"+device);
						console.log("onmessage:: room: "+room+", device: "+device+", val: "+val+", ind: "+ind);
						devices[ind]['val']=val;
						if ((room == s_room_id) && (s_screen == 'room')) {
							activate_room(s_room_id);
						}
					}
				break;
				
				default:
					message("Unknown message: action: "+action+", tcnt: "+tcnt+", mes: "+msg+", type: "+type);
			}
			//return(0);
		};// on-message
		
		console.log("Websocket:: readyState: "+w_sock.readyState);
		
	//}//rasp and !phonegap	
}//function


// ----------------------------------------------------------------------------------------
// When device is ready, confirm certain parameters in the device
// This function runs for PhoneGap/Mobile only, where we need
// to retrieve/store the IP address of the server
//
// The username and pin are not necessary for local operation, but
// they are required once we access the app over the internet.

function onLinePopup() {
	
	var uname= window.localStorage.getItem("uname");		// username
	var pword= window.localStorage.getItem("pword");		// pin
	var saddr= window.localStorage.getItem("saddr");		// Server address
	// alert("OnLinePopup:: addr: "+saddr);
	
	var str;
	//str += '<div data-role="page" id="page1">';
	//str += '<div data-role="header">Login</div>';
	//str += '<div data-role="content">';
	
	//str += '<a href="#loginpopup" data-rel="popup" data-position-to="window" data-transition="pop" class="ui-btn ui-corner-all ui-shadow ui-btn-inline ui-icon-delete ui-btn-icon-left ui-btn-b">User page...</a>';
	str += '<div data-role="popup" id="loginpopup" data-overlay-theme="b" data-theme="b" data-dismissible="false" style="max-width:400px;">';
	
	str += '<div data-role="header" data-theme="a">';
    str += '<h1>User Access</h1>';
    str += '</div>';
	
    str += '<div role="main" class="ui-content">';
	str	+= '<fieldset>';
	str += '<label for="saddr" class="ui-hidden-accessible pops">Server IP</label>';
	if (saddr !== null)
		str		+= '<input type="text" name="saddr" id="saddr" value="'+saddr+'"><br/>';
	else str	+= '<input type="text" name="saddr" id="saddr" placeholder="server ip"><br/>';
		
	str 		+= '<label for="uname" class="ui-hidden-accessible pops">Username</label>';
	if (uname !== null )
		str 	+= '<input type="text" name="uname" id="uname" value="'+uname+'"><br/>';
	else str	+= '<input type="text" name="uname" id="uname" placeholder="username"><br/>';
		
	str			+= '<label for="pword" class="ui-hidden-accessible pops">Password</label>';
	if (pword !== null)
		str		+= '<input type="password" name="pword" id="pword" value="'+pword+'"><br/>';
	else str	+= '<input type="password" name="pword" id="pword" placeholder="pin"><br/>';
	str += '</fieldset>';
	
	str += '<a href="#" id="cancelSubmit" class="ui-btn ui-corner-all ui-shadow ui-btn-inline ui-btn-b" data-rel="back">Cancel</a>';
	str += '<a href="#" id="loginSubmit" class="ui-btn ui-corner-all ui-shadow ui-btn-inline ui-btn-b" data-rel="back" data-transition="flow">Submit</a>';
	str += '</div>';											// main
	
	str += '</div>';											// role popup				
	//str += '</div>';											// page
	
	// QQQQ		
	$( "#popup" ).append(str);									// write the popup form to the popup anchor
	$( "#loginpopup" ).popup();									// define the form
	$( "#loginpopup" ).popup( "open" );							// Open the form
	
	$( "#loginSubmit" ).click(function(event,ui) {
		//alert("login");	
		console.log("login");
		saddr = $( "#saddr" ).val();
		uname = $( "#uname" ).val();
		pword = $( "#pword" ).val();
		window.localStorage.setItem("uname",uname);
		window.localStorage.setItem("pword",pword);
		window.localStorage.setItem("saddr",saddr);
		console.log("popup closed with ip: "+saddr);
		murl='http://'+saddr+'/';	
		s_controller = murl + 'backend_rasp.php';
		if (phonegap != 1) init_websockets();
		var ret = load_database("init");
		if (ret <0) {
			alert("Error:: Loading Database Failed");
		}
		$( "#loginpopup" ).popup( "close" );
		return(false);
	});
	
	$( "#cancelSubmit" ).click(function(event,ui) {
		//alert("Cancel, assume we have defult values ...");
		murl='http://'+saddr+'/';	
		s_controller = murl + 'backend_rasp.php';
		if (phonegap != 1) init_websockets();
		var ret = load_database("init");
		if (ret <0) {
			alert("Error:: Loading Database Failed");
		}
		//$( "#loginpopup" ).popup( "close" );
		return(false);
	});
			
}// function

}); // Doc Ready end

} //start_LAMP() function end






// ----------------------------------------------------------------------------------------
//	function message, displays a message down in the gui_messages area
//	Input Parameter is now just the text to display
//
function message(txt,lvl) 
{
	if (debug >2 ) alert("Message called: "+txt+", lvl: "+lvl+", debug: "+debug);
	if (typeof lvl != 'undefined') {
		// alert("defined");
	}
	else {
		// alert("undefined");
		lvl = debug ;
		//alert("setting debug in message");
	}
	if (lvl <= debug) {
		$( "#gui_messages" ).empty("")
		txt = '<div id="comment">' + txt + '</div>'
		$( "#gui_messages" ).append( txt );	
	}
	return(0);
}


// -------------------------------------------------------------------------------------
// Set the initial room, and mark the button of that room
// See function above, we will call from load_database !!!
//
function init() {
	debug = settings[0]['val'];
	cntrl = settings[1]['val'];
	if (cntrl == 0) {
		s_controller = murl + 'backend_ics.php';
	}
	else {
		s_controller = murl + 'backend_rasp.php';
	}
	mysql = settings[2]['val'];
	persist = settings[3]['val'];
	if (jqmobile != 1) { 
		skin = settings[4]['val'];
		$("link[href^='styles']").attr("href", skin);
	}
	init_rooms(s_room_id);										// Initial startup config
	init_menu(s_setting_id);		
}		

// ************************ SUPPORTING FUNCTIONS *********************************
//
//	Get the time
//
function getTime() {
  var date = new Date();
  return pad(date.getHours(), 2) + ':' + pad(date.getMinutes(), 2) + ':' + pad(date.getSeconds(), 2);
}

// Read Integer from string
// 
function parse_int(s) {
	return(s.match(/\d+\.?\d*/g));					// returns array with values
}

function read_int(s) {								// Read only first in in string
	var ret = s.match(/\d+\.?\d*/g);
	return (ret[0]);
}


// ----------------------------------------------------------------------------
// Alert Box
//
function myAlert(msg, title) {

  $('<div style="padding: 10px; min-width: 250px; max-width: 500px; word-wrap: break-word;">'+msg+'</div>').dialog({
    draggable: false,
    modal: true,
    resizable: false,
    width: 'auto',
    title: title || 'Confirm',
    minHeight: 75,
    buttons: {
      OK: function () {
        //if (typeof (okFunc) == 'function') {
         // setTimeout(okFunc, 1);
        //}
        $(this).dialog('destroy');
      }
    }
  });
}


// ----------------------------------------------------------------------------
// Dialog Box, confirm/cancel
//
function myConfirm(dialogText, okFunc, cancelFunc, dialogTitle) {
  $('<div style="padding: 10px; max-width: 500px; word-wrap: break-word;">' + dialogText + '</div>').dialog({
    draggable: false,
    modal: true,
    resizable: false,
    width: 'auto',
    title: dialogTitle || 'Confirm',
    minHeight: 75,
    buttons: {
      OK: function () {
        if (typeof (okFunc) == 'function') {
          setTimeout(okFunc, 50);
        }
        $(this).dialog('destroy');
      },
      Cancel: function () {
        if (typeof (cancelFunc) == 'function') {
          setTimeout(cancelFunc, 50);
        }
        $(this).dialog('destroy');
      }
    }
  });
}

// -------------------------------------------------------------------------------
// Helper function for askForm
//
function checkLength( o, n, min, max ) {
	if ( o.val().length > max || o.val().length < min ) {
		o.addClass( "ui-state-error" );
		updateTips( "Length of " + n + " must be between " +
		min + " and " + max + "." );
		return false;
	} else {
		return true;
	}
}

// -------------------------------------------------------------------------------------
// Dialog Box, Ask for  details as specified in function paramters
// 1. Your dialog text,including the button specification (see activate_room for a description)
// 2. The function to execute when user has provided input
// 3. The function to execute when operation is cancelled
// 4. The title of your dialog
//
// Input Values (only val_1 is required, other optional for more or less input fields
// val_1, val_2, val_3 etc 
// Return values is an array in var ret, So ret[0] may contain values just as many as val_x
//
function askForm(dialogText, okFunc, cancelFunc, dialogTitle) {
  if (jqmobile ==1) {
	//alert("askForm jqmobile");
	// We assume that for jqmobile setting we receive a dialogtext
	// that contains jQM correct html tags so that we can use this
	// functions semi-generic for jQuery mobile and jQuery UI
	//QQQQ
	$( "#gui_content" ).append(dialogText);					// display the popup form
	$( "#myform" ).popup();									// define the form
	$( "#myform" ).popup( "open" );							// Display Open the form
	
	// The function below is the callback function for when the popup form has closed
	$( "#myform" ).on( "popupafterclose", function(event, ui) {
			if (typeof (okFunc) == 'function') {
				// Return max of 4 results (may define more)...
				var ret = [ $("#val_1").val(), $("#val_2").val(), $("#val_3").val(), $("#val_4").val() ];
				setTimeout(function(){ okFunc(ret) }, 50);
        	}								   
	});
  }
  // jQuery UI style of dialog
  else {
  $('<div style="padding: 10px; max-width: 500px; word-wrap: break-word;">'+dialogText+'</div>').dialog({
    draggable: false,
    modal: true,
    resizable: false,
	width: 'auto',
    title: dialogTitle || 'Confirm',
    minHeight: 120,
    buttons: {
    	OK: function () {
			//var bValid = true;
//			bValid = bValid && checkLength( name, "name", 3, 16 );
        	if (typeof (okFunc) == 'function') {
				// Return max of 4 results (may define more)...
				var ret = [ $("#val_1").val(), $("#val_2").val(), $("#val_3").val(), $("#val_4").val() ];
				setTimeout(function(){ okFunc(ret) }, 50);
        	}
      		$(this).dialog('destroy');
      	},
		Cancel: function () {
      		if (typeof (cancelFunc) == 'function') {
      			setTimeout(cancelFunc, 50);
        	}
        	$(this).dialog('destroy');
		}
    },
 	close: function() {
		$(this).dialog('destroy');
	}
  });
  // console.log(" name: "+name.val);
  }
} // askForm end


// ---------------------------------------------------------------------------------
// Setup the rooms event handling. The ini_function is mere concerned with building
// the header section of the room screen, so selecting rooms, adding and deleting
// rooms.
//
// After work done, it will call the activate_room function to handle the content area
//
// The handler for init-room headers is found in the document ready function at the top
//
function init_rooms(cmd) 
{
	// The rooms variable, and devices for rooms are defined in load_database()
	// First define the handler, and then activate_room() will make buttons for those devices
	//<input type="submit" id="' + id + '" value= "'+ val + '" class="buttons">
	
	$("#gui_header").empty();
						 
	// For all rooms write a button to the document
	$("#gui_header").append('<table border="0">');				// Write table def to DOM
	var table = $( "#gui_header" ).children();					// to add to the table tree in DOM
	
	var but = '<tr class="rroom">' ;
	but += '<td>';
	for (var i = 0; i < rooms.length; i++ ) 
	{
		room_name = rooms[i]['name'];
		room_id = rooms[i]['id'];
		if (room_id == s_room_id) {
			but += room_button(room_id, room_name, "hover");
		}
		else {
			but += room_button(room_id, room_name);				// Write a room button to the document
		}
	}
	but += "</td>";
	
	but +=  "<td>" ;
	but += '<input type="submit" id="Add" value= "+"  class="cr_button new_button">'  ;
	but += '<input type="submit" id="Del" value= "X"  class="cr_button del_button">'  ;
	but += '<input type="submit" id="Help" value= "?" class="cr_button help_button">'  ;
	but += "</td>";
	$(table).append(but);	
	
	//	Display the devices for the room at the first time run
	s_screen='room';
	activate_room(s_room_id);		

}

// -----------------------------------------------------------------------------------------
// Setup the scenes event handling
//
function init_scenes(cmd) 
{

		$("#gui_header").empty();
		$("#gui_header").append('<table border="0">');			// Write table def to DOM
		var table = $( "#gui_header" ).children();				// to add to the table tree in DOM
		var msg = 'Init Scenes, scenes read: ';			
		var but = '<tr class="rroom">' ;	
		but += "<td>";
		for (var j = 0; j<scenes.length; j++ ){
  
			var scene_id = scenes[j]['id'];
			var scene_name = scenes[j]['name'];
			var scene_seq = scenes[j]['seq'];
			
			msg += j + ', ';
			if (scene_id == s_scene_id ) {
//				but +=  "<td>" + scene_button(scene_id, scene_name, "hover") + "</td>" ;
				but +=  scene_button(scene_id, scene_name, "hover") ;
			}
			else {
//				but +=  "<td>" + scene_button(scene_id, scene_name) + "</td>" ;
				but +=  scene_button(scene_id, scene_name) ;
			}
					
		}
		but += "</td>";
		message (msg);
		// Add special buttons for controlling the scenes
		// Add a scene
		but +=  "<td>" ;
		but += '<input type="submit" id="Add" value= "+" class="cs_button new_button">'  ;
		but += '<input type="submit" id="Del" value= "X" class="cs_button del_button">'  ;
		but += '<input type="submit" id="Help" value= "?" class="cs_button help_button">'  ;
		but += "</td>";
		
		$(table).append(but);
		s_screen='scene';					// Active sreen is a scene screen now
		activate_scene(s_scene_id);			// Activate the first scene with the id s_scene_id
}

// --------------------------------------------------------------------------------------
//
// Setup the timers event handling
//
function init_timers(cmd) 
{

		$("#gui_header").empty();
		$("#gui_header").append('<table border="0">');			// Write table def to DOM
		var table = $( "#gui_header" ).children();				// to add to the table tree in DOM
		var msg = 'Init Timers, timers read: ';	
		
		
		var but = '<tr class="rroom">' ;
		but += '<td>';
		for (var j = 0; j<timers.length; j++ ){
  
			var timer_id = timers[j]['id'];
			var timer_name = timers[j]['name'];
			var timer_seq = timers[j]['seq'];
			
			msg += j + ', ';
			if (timer_id == s_timer_id ) {
				but +=  timer_button(timer_id, timer_name, "hover");
			}
			else {
				but +=  timer_button(timer_id, timer_name);
			}			
		}
		message (msg);
		but += '</td>';
		// Add special buttons for controlling the scenes
		// Add a scene
		but +=  '<td>';
		but += '<input type="submit" id="Add" value= "+" class="ct_button new_button">'  ;
		but += '<input type="submit" id="Del" value= "X" class="ct_button del_button">'  ;
		but += '<input type="submit" id="Help" value= "?" class="ct_button help_button">'  ;
		but += '</td>';		
		$(table).append(but);
		
		s_screen = 'timer';
		activate_timer(s_timer_id);
}

// --------------------------------------------------------------------------------------
//
// Setup the timers event handling
//
function init_handsets(cmd) 
{

		$("#gui_header").empty();
		$("#gui_header").append('<table border="0">');			// Write table def to DOM
		var table = $( "#gui_header" ).children();				// to add to the table tree in DOM
		var msg = 'Init Handsets, handsets read: ';	

		var but = '<tr class="rroom">' ;
		but += '<td>';
		var hset_list=[];										// Array of names that we like to put in the header
		for (var j = 0; j<handsets.length; j++ )
		{
			// If this handset is already in our list ...
  			if ( $.inArray(handsets[j]['id'],hset_list) == -1) {
				//alert("adding id: "+j);
				var handset_id    = handsets[j]['id'];
				var handset_name  = handsets[j]['name'];
				var handset_addr  = handsets[j]['addr'];
				var handset_unit  = handsets[j]['unit'];
				var handset_val   = handsets[j]['val'];
				var handset_scene = handsets[j]['scene'];
				msg += j + ', ';
				// Check whether this is a new handset
			
				// in_array?
				if (handset_id == s_handset_id ) {
					but +=  handset_button(handset_id, handset_name, "hover");
				}
				else {
					but +=  handset_button(handset_id, handset_name);
				}
				
				hset_list[hset_list.length]= handsets[j]['id'];
				
			}
		}
		message (msg);
				
		but += '</td>';
		// Add special buttons for controlling the handsets
		but +=  '<td>';
		but += '<input type="submit" id="Add" value= "+" class="ch_button new_button">'  ;
		but += '<input type="submit" id="Del" value= "X" class="ch_button del_button">'  ;
		but += '<input type="submit" id="Help" value= "?" class="ch_button help_button">'  ;
		but += '</td>';		
		$(table).append(but);
		
		s_screen = 'handset';
		activate_handset(s_handset_id);
}


// ------------------------------------------------------------------------------------------
// Setup the scenes event handling
//
function init_settings(cmd) 
{
		$("#gui_header").empty();
		$("#gui_header").append('<table border="0">');	// Write table def to DOM
		var table = $( "#gui_header" ).children();		// to add to the table tree in DOM
		var msg = 'Init Config, config read: ';	
		// XXX rroom??
		var but = '<tr class="rroom">' ;
		but += '<td>';
		for (var j = 0; j<settings.length; j++ ){
  
			var setting_id = settings[j]['id'];
			var setting_name = settings[j]['name'];
			var setting_val = settings[j]['val'];
			msg += j + ', ';
			
			if ( setting_id == s_setting_id ) {
				but +=  setting_button(setting_id, setting_name, "hover");
			}
			else
			{
				but +=  setting_button(setting_id, setting_name);
			}	
		}
		message (msg);
		but += '</td>';	
		but +=  '<td>';
		but += '<input type="submit" id="Help" value= "?" class="cc_button help_button">'  ;
		but += '</td>';
		$(table).append(but);	
		
		s_screen = 'config';
		activate_setting(s_setting_id);	
}



// ------------------------------------------------------------------------------------------
// Setup the main menu (on the right) event handling
//

function init_menu(cmd) 
{
	html_msg = '<table border="0">';
	$( "#gui_menu" ).append( html_msg );
	var table = $( "#gui_menu" ).children();		// to add to the table tree in DOM
		
	// For all menu buttons, write all to a string and print string in 1 time
	if (jqmobile == 1) {
			var but =  ''
		+ '<tr><td>'
		+ '<input type="submit" id="M1" value= "Rooms" class="hm_button hover">' 
		+ '<input type="submit" id="M2" value= "Scenes" class="hm_button">'
		+ '<input type="submit" id="M3" value= "Timers" class="hm_button">'
		+ '<input type="submit" id="M4" value= "Handsets" class="hm_button">'
		+ '<input type="submit" id="M5" value= "Config" class="hm_button">'
		+ '</td></tr>'
		;
		$(table).append(but);
	}
	else {
		var but =  ''	
		+ '<tr class="switch"><td><input type="submit" id="M1" value= "Rooms" class="hm_button hover"></td>' 
		+ '<tr class="switch"><td><input type="submit" id="M2" value= "Scenes" class="hm_button"></td>'
		+ '<tr class="switch"><td><input type="submit" id="M3" value= "Timers" class="hm_button"></td>'
		+ '<tr class="switch"><td><input type="submit" id="M4" value= "Handsets" class="hm_button"></td>'
		+ '<tr><td></td>'
		+ '<tr><td></td>'
		+ '<tr class="switch"><td><input type="submit" id="M5" value= "Config" class="hm_button"></td>'
		;
		$(table).append(but);
	}
	// EVENT HANDLER
	
		$("#gui_menu").on("click", ".hm_button", function(e){
			e.preventDefault();
//			e.stopPropagation();
			selected = $(this);
						
			value=$(this).val();								// Value of the button
			id = $(e.target).attr('id');						// should be id of the button (array index substract 1)
			$( '.hm_button' ).removeClass( 'hover' );
			$( this ).addClass ( 'hover' );
			switch(id)
			{
				case "M1":
					init_rooms ("init");

				break;
				
				case "M2":
					message("Menu: Define scenes");
					init_scenes(s_scene_id);
				break;
				
				case "M3":
					message ("Menu: Set your timers");
					init_timers();
					//
				break;
				
				case "M4":
					message ("Menu: Set your Handsets");
					init_handsets();
					//
				break;
				
				case "M5":
					message("Menu: Configuration Editor");
					init_settings();
				break;
				
				default:
					message('init_menu:: id: ' + id + ' not a valid menu option');
			}
	}); 	
}



// --------------------------------------------------------------------------------
// Select a room and change rooms
//		Input is the id number for the new room
// If selectable is set, the devices in the room will be displayed with select boxes 
//
function activate_room(new_room_id, selectable) 
{
	var html_msg;	
	var room_name;
	// Maybe we should make sure that we do not change to the current room
	// where new_room_id == s_room_id. 
	// If we do so, s_room_id must not be initialized on 1

	for (var i=0; i< rooms.length; i++) {
		if (rooms[i]['id']== new_room_id) {
				room_name = rooms[i]['name'];
				break;
		}
	}
	// 	Clean the DOM area where we want to output devices
	// Empty the parent works best in changing rooms
	$("#gui_content").empty();

	// XXX We might have to destroy the old sliders, depending
	// whether the memory s reused for the sliders or we keep on allocating new memory with every room change
	html_msg = '<div id="gui_devices"></div>';
	$( "#gui_content" ).append(html_msg);

	// First table contains special button "ALL OFF"
	// Start writing the table code to DOM
	html_msg = '<table border="0">';
	$( "#gui_devices" ).append( html_msg );
	var table = $( "#gui_devices" ).children();		// to add to the table tree in DOM	
	
	var but = '<thead><tr class="switch">' ;
	if (selectable == "Del") { but+= '<td colspan="2">' ; }
		else {but += '<td>' };
	but += '<input type="submit" id="Rx" value="X" class="dbuttons del_button" >'
		+ '<input type="submit" id="Ra" value="+" class="dbuttons new_button" >'
		+ '</td>'
		;
	but += '<td class="filler" align="center">'+room_name+'</td>';
	if (jqmobile == 1) {
		but += '<td><input type="submit" id="Fa" value="ALL OFF" class="dbuttons" ></td>';
	}
	else {
		but +='<td></td>';					// Because in non jqmobile dimmers display value in this column
		but += '<td colspan="2"><input type="submit" id="Fa" value="ALL OFF" class="dbuttons" ></td>';
	}
	$(table).append(but);
	$(table).append('</tr>');
			
	// Now start a second table body for the room items to be sortable
	html_msg = '</thead><tbody>';	
	$(table).append(html_msg);
	table = $( "#gui_devices tbody" ).last();
		
	for (var j = 0; j<devices.length; j++ ){
  
		var device_id = devices[j]['id'];
		var room_id = devices[j]['room'];
			
       	if( room_id == new_room_id )
		{
			var device_name = devices[j]['name'];
			var device_type = devices[j]['type'];
			var device_val  = devices[j]['val'];				// Do NOT use lastval here!
			var offbut, onbut;
				
			if ( device_val == 0 ) {							// device value, not the button value
				offbut = " hover";
				onbut = "";
			}
			else {
				offbut = "";
				onbut = " hover" ;
			};
				
			// add the html of button, depending on the type switch or dimmer
			switch (device_type) 
			{ 
			case "switch": 
				
				// Below is the on/off device. Some code double, but better readable
				// For jqmobile the layout, but also slider difinitions are different
				if (jqmobile == 1) {
					var but =  '<tr class="devrow switch">' ;
					if (selectable == "Del") 
						but+= '<td><input type="checkbox" id="'+device_id+'c" name="cb'+device_id+'" value="yes" class="dbuttons"></td>';
					but += '<td colspan="2"><input type="text" id="'+device_id+'" value="'+device_name+'" class="dlabels"></td>';

					but += '<td><input type="submit" id="'+device_id+'F0'+'" value="OFF" class="dbuttons'+offbut+'">';
					but += '<input type="submit" id="'+device_id+'F1'+'" value="ON" class="dbuttons'+onbut+'"></td>'
//					+ '</tr>' 
//					+ '</div>'
					;
				}		// NOT jqmobile, but browser
				else {
					var but =  '<tr class="devrow switch">' ;
					if (selectable == "Del") 
						but+= '<td><input type="checkbox" id="'+device_id+'c" name="cb'+device_id+'" value="yes" class="dbuttons"></td>';
					but += '<td colspan="2"><input type="submit" id="'+device_id+'" value= "'+device_name+'" class="dlabels"></td>';
					but += '<td></td>';	
					but += '<td><input type="submit" id="'+device_id+'F0'+'" value= "'+"OFF" +'" class="dbuttons'+offbut+'"></td>';
					but += '<td><input type="submit" id="'+device_id+'F1'+'" value= "'+"ON" +'" class="dbuttons'+onbut+'"></td>';
				}
				$(table).append(but);
					// Set the value read from load_device in the corresponding button
			break;
			
			case "dimmer":	
					// Unfortunately, code for jqmobile and Web jQuery UI is not the same
				if (jqmobile == 1) {	
					var slid = '<tr class="devrow dimrow">';
					if (selectable == "Del")
						slid += '<td><input type="checkbox" id="'+device_id+'c" name="cb'+device_id+'" value="yes" class="dbuttons"></td>';	
					slid += '<td colspan="2" ><label for="'+device_id+'Fd">'+device_name+'</label>';
					slid += '<input type="number" data-type="range" style="width:25px;" id="'+device_id+'Fd" name="'+device_id+'Fl" value="'+device_val+'" min=0 max=31 data-highlight="true" data-mini="false" data-theme="b" /></td>';
					slid += '<td><input type="submit" id="'+device_id+'F0'+'" value= "OFF" class="dbuttons'+offbut+'" />';
					slid += '<input type="submit" id="'+device_id+'F1'+'" value= "ON" class="dbuttons'+onbut+'" /></td>';
					slid += '</tr>';
				}
				else // This is the jQuery UI normal
				{
					var slid = '<tr class="devrow dimrow">' ;
					if (selectable == "Del")
						slid += '<td><input type="checkbox" id="'+device_id+'c" name="cb'+device_id+'" value="yes" class="dbuttons"></td>';
					slid += '<td><input type="submit" id="' +device_id 
						+ '" value= "'+device_name + '" class="dlabels"></td>'
						+ '<td><div id="' +device_id + 'Fd" class="slider"></div></td>'	
						+ '<td><input type="text" id="' +device_id+'Fl" class="slidval"></td>'
						// On/Off buttons
						+ '<td><input type="submit" id="'+device_id+'F0'+'" value="OFF" class="dbuttons'+offbut+'"></td>'
						+ '<td><input type="submit" id="'+device_id+'F1'+'" value="ON" class="dbuttons'+onbut+'"></td>'
						+ '</tr>'
						;
				}
				table.append(slid);
							
				//XXX		
				// eventhandler for the slider. Use a div and id to make distict sliders
				// This function works only if the handler is put AFTER the sliders generated
				// So if we want to connect to a
					
				var label ="#"+device_id+"Fl"; 
				var slidid="#"+device_id+"Fd";

				//XXX	Dimmer/Slider handling must be here for the moment. Every slider is "static" and belongs to
				//		and is declared for a specific device
				//		Move to doc ready section as soon as possible 

				// eventhandler for the slider. Use a div and id to make distict sliders
				// This function works only if the handler is put AFTER the sliders generated
				// NOTE:: The handler is asynchronous, you never know when it is called
				// and it's context at that moment is unknown wrt variables in this function
				if (jqmobile==1) 
				{ 					// SLIDER FOR MOBILE
				  $(function() 
				  {
					var val = load_device(room_id, device_id);
					if (val == 'F0') { val = 0; }
					$( slidid ).slider
					({
					 	stop: function( event, ui ) {
							// This is where it happens for the value of the action
							var id = $(event.target).attr('id');
							var val = $(event.target).val();
							//var val2 = ui.value;
		
							// For slider==0 a special case. We want to switch OFF the device
							// As the dimmer command only accepts values 1-32, for value 0 we
							// make a special case and set the value of button OFF to be pressed.
							if ( val == 0 ) { 								
								// strip id and change val "D1Fd"+"P0" ==>> "D1"+"F0"
								handle_device( id.slice(0,-2), "F" + val );		 
								// Remove hover from "ON" and put the hover on the OFF button
								$("#"+id.slice(0,-2)+"F1").removeClass( 'hover' );
								$("#"+id.slice(0,-2)+"F0").addClass( 'hover' );
							} 
							else { 
								handle_device( id, "P" + val );				// id ="D1Fd", value = "P31"
								$("#"+id.slice(0,-2)+"F0").removeClass( 'hover' );
								$("#"+id.slice(0,-2)+"F1").addClass( 'hover' );
							}
							store_device(s_room_id, id.slice(0,-2), val);
						}
					});
					$( slidid ).slider("refresh");
				  });
				}
				else			// NORMAL SLIDER, 
				$(function() 
				{
					// Load database value
					var val = load_device(room_id, device_id);
					// If the OFF buton is pressed, put the slider to lowest position
					if (val == 'F0') { val = 0; }
  					$( slidid ).slider
					({
						range: "max",
						main: 1,
						min: 0,
						max: 32,
						value: val,
						slide: function( event, ui ) {
							// This is where it happens for the label
							// Problem is we need to update the correct label
							var id = $(event.target).attr('id');
							// strip last character of id of slider object
							// and replace with a l for the label object
							// For more than 9 devices, may be 4! chars eg. string ="D10F"							
							var lid = '#' + id.slice(0,-1) + 'l';

							$( lid ).val (ui.value);
						},
						stop: function( event, ui ) {
							// This is where it happens for the value of the action
							var id = $(event.target).attr('id');
							var val = ui.value;
							// For slider==0 a special case. We want to switch OFF the device
							// As the dimmer command only accepts values 1-32, for value 0 we
							// make a special case and set the value of button OFF to be pressed.
							if ( val == 0 ) 
							{ 
								val = 0 ;	
								// strip id and change val "D1Fd"+"P0" ==>> "D1"+"F0"
								handle_device( id.slice(0,-2), "F" + val );		 
								// Remove the hover from the current button (probably "ON")
								$( this ).parent().siblings().children().removeClass( 'hover' );
								// Now put the hover on the OFF button
								$( this ).parent().siblings().children("#"+id.slice(0,-2)+"F0").addClass( 'hover' );
							} // WWW
							else { 
								handle_device( id, "P" + val );				// id ="D1Fd", value = "P31"
								$( this ).parent().siblings().children().removeClass( 'hover' );
								$( this ).parent().siblings().children("#"+id.slice(0,-2)+"F1").addClass( 'hover' );
							}
							store_device(s_room_id, id.slice(0,-2), val);
						}
					});
					// Initial value of the slider at time of definition
					$( label ).val( val );
  				}); // Slider Function
				
			break;
			
			default:
					alert("lamp_button, type: "+device_type+" unknown");
			} // switch	
				
		}// room
       };//for		
					
		s_room_id = new_room_id;				
				
		// Listen to ALL (class) buttons for #gui_devices which is subclass of DIV #gui_content
		
		$( "#gui_devices" ).on("click", ".dbuttons" ,function(e) 
		{
			e.preventDefault();
//			e.stopPropagation();

			value=$(this).val();									// Value of the button
			var but_id = $(e.target).attr('id');					// id of the device (from the button_id)
			
			switch ( but_id )
			{
			// ROOM ADD BUTTON (Adds a DEVICE to a ROOM)
			case "Ra":
				if (debug>2) alert("Room Add Button: "+but_id);
				// Find an empty device['id'] for this room, and if none left, create a new one
				// at the end of the devices array, provided we do not have more than 16 devices
				// for this room. We could make this a function...
				var ind = 1;
				// Look for matching indexes. This is a time-exhausting operation, but only when adding a device
				while (ind <= max_devices) { 
					for (var i=0; i< devices.length; i++) {
						if (( devices[i]['room'] == s_room_id ) && ( devices[i]['id'].substr(1) == ind )) {
							// alert("found this ind: "+ind+" on pos "+i+", room: "+s_room_id);
							// We found this index is already used!
							break; // for
						}
					}
					// If we are here, then we did not find device with id == "D"+ind
					// So the ind is unused, we use it
					if (i == devices.length){
						
						break; // while
					}
					ind++;
				}
				if (debug > 1) alert("Add device:: room:"+s_room_id+", device: "+ind+", devices.length: "+devices.length);
				// Let user fill in a form at this point!
				
				// Prepare for additional selectbox: The brand of the receiver
				var list = [];
				var str = '<label for="val_3">  Select Brand: </label>'
						+ '<select id="val_3" value="kaku">' ;   // onchange="choice()"
				for (var i=0; i<brands.length; i++) {
					str += '<option>' + brands[i]['name'] + '</option>';
				}
				str += '</select>';
				
				// Generate the complete form for adding a device
				// XXX Need to improve and add field for address for example
				//
				var ret;
				var gaddr = Number(s_room_id) + 99;
				askForm('<form id="addRoomForm"><fieldset>'
					+ '<p>You have created a new device, please give it a name and specify its type and brand. '
					+ 'Optionally, the group address can be set if this device address is different from the room address</p>'
					+ '<label for="val_1">Name: </label>'
					+ '<input type="text" name="val_1" id="val_1" value="" class="text ui-widget-content ui-corner-all" />'
					+ '<br />'
					+ '<label for="val_2">Type: </label>'
					+ '<select id="val_2" value="switch" ><option selected="selected">switch</option>'
					+ 									'<option>dimmer</option></select><br />'
					+ str
					+ '<label for="val_4">Group addr: </label>'
					+ '<input type="text" name="val_4" id="val_4" value="'+ gaddr+'" class="text ui-widget-content ui-corner-all" />'
					+ '</fieldset></form>'
					
					// Create
					,function (ret) {
						// OK Func, need to get the value of the parameters
						// Add the device to the array
						// SO what are the variables returned by the function???
						if (debug > 2) alert(" Dialog returned val_1,val_2,val_3: " + ret);	
						
						// Now figure out the fname for the brand name
						var brnd_id, brnd_nm;
						for (var i=0; i<brands.length; i++) {
							if (brands[i]['name'] == ret[2]) {
								brnd_id = brands[i]['id'];
								brnd_nm = brands[i]['fname'];
							}
						}
						
						// Validate response. Dimmer type is not always allowed. For the moment we trust the user 
						// more or less
						if ((ret[1]=="dimmer") && (brnd_nm != "kaku")) {
							alert("Type dimmer is not supported for brand "+brnd_nm);
							return(1);
						}
						// All OK? Make a new device in the room
						var newdev = {
							id: "D"+ind,
							room: ""+s_room_id+"",
							gaddr: ret[3],					// Initial Value, is room_id + 99
							name:  ret[0],
							type:  ret[1],
							val: "0",
							lastval: "0", 
							brand: brnd_id
						}
						devices.push(newdev);			// Add record newdev to devices array
						console.log(newdev);
						send_2_dbase("add_device", newdev);
						// And add the line to the #gui_devices section
						activate_room(s_room_id);
						return(1);	//return(1);
						
					// Cancel	
  					}, function () {
							activate_room (new_room_id);
						return(1); // Avoid further actions for these radio buttons 
  					},
  					'Confirm Create'
				); // askForm
				return(1);		

			break; // Ra add a device to room
			
			case "Rx":
				// We allow deletion of only ONE roomdevice at a time
				// Would like to blur background and disable ALL further activities in room until user clicks on a row
				
				message('<p style="textdecoration: blink; background-color:yellow; color:black;">Click a button to delete ...</p>');
				// alert("Delete a device: \nPlease select the device you like to delete by clicking its radio button left on line. ");

				// Calling this function with parmeter Del does the trick				
				activate_room (new_room_id, "Del");
				// After executing this function recursively, it comes back to this place
				return(1);
			break;
			
			// All OFF in room works; command is sent to daemon who updates the database too.
			case "Fa":
				
				// Could use group function of remote, but that will NOT work accross brands
				
				// All OFF Pressed, No room specified!!
				handle_device( "", "Fa" );
				// for every device in this room set memory value to off
				for (var j=0; j< devices.length; j++) {
					if (devices[j]['room'] == s_room_id ) {
						//
						// store_device should have a local function of storing to devices object
						// Syncing to databases (based on value of persist) is a function of the daemon
						// XXX Need to relax the timer for SQL to 10 secs or so, or do group update (better);
						
						store_device(s_room_id, devices[j]['id'], "OFF"); // Was F0
					}
				}
				
				// And update the page, or update row. Given that all devices are
				// affected by this command, we will redraw the page
				activate_room(s_room_id);
				return(1);
			break;
			
			default:
				// DO NOTHING, must be a device button pressed, so continue reading below
			}
			
			// Now first see if we have a special case with op selectable boxes
			//DEL Delete action by pressing a line when the checkbox is open.
			
			if ((selectable == "Del") && ( $(this).attr("type" ) == "checkbox") ) 
			{ 
				if (debug < 1) $("#gui_messages").empty();			// Clear messages
				// Button id pressed = D1c -> D16c
				var id = but_id.slice(0,-1);						// As device id may range D1-D16, only strip the last 'c'
				var dev_index = find_device(s_room_id,id);
				var that = $(this);
				message("Device to delete: id Name" + devices[dev_index]['name'], 0);
				
				myConfirm('You have selected device '+devices[dev_index]['name']+' for deletion. Do you really want to delete this device?', 
					// Confirm
					function () {
						that.closest("tr").remove() ;
						// remove that device from the devices array. Send removed back to the backend to persist
						var removed = devices.splice(dev_index ,1);
						if ( persist > 0 ) {
							console.log(removed[0]);
							send_2_dbase("delete_device", removed[0]);
							if (debug>1)
								alert("Removed from dbase:: id: " + removed[0]['id'] + " , name: " + removed[0]['name']);
								//alert (JSON.stringify(removed));
						}
						// Sync devices array to the database OR send it the device to-be-removed
						if (debug > 1)
							alert ("Removed object id:" + id );
							// Should do the trick as there is no further device to handle
							activate_room (new_room_id);
						return(1);
					// Cancel	
  					}, function () {
							activate_room (new_room_id);
						return(1); // Avoid further actions for these radio buttons 
  					},
  					'Confirm Delete'
				);
				// Return here as there is no device to handle
				return(1);
			}
			

			// SEL Select a row, for example to be used inside a scene
			//
			if (( selectable == "Sel" ) && ( $(this).attr("type") == "checkbox")) 
			{
				message("Device Add",1);
				alert ("Device Add\nid: " + id );
				
				return(1); // Must be the last line in this IF
			}
			
			// ELSE :: THIS IS A REGULAR DEVICE BUTTON 
			// Assume that one of the device buttons were pressed on the #gui_devices
			// screen. So just normal operation. Perform the button actions
			
			// Although a button is pressed, the behaviour for ON and OFF
			// is different for switches and dimmers:
			// A switch will just ON/OFF like the default code.
			// NOTE: value contains the value of the button (OFF or ON) on screen
			
			// Translate the value of button to a meaningful device message to be sent to backend
			// Button ID, affected are D1F0 -> D16F0.
			var but_id = $(this).attr("id"); 
			id = but_id.slice(0,-2);							// XXX Take last 2 chars off from button ID to get device ID
			value=$(this).val();
			
			handle_device(id, value);							// id like "D1", button value like "ON" or "OFF"
			
			// Store device will also deal with ON and OFF. It stores in SQL
			// XXX should be based on persist here, or in store-device
			store_device(s_room_id, id, value);
			
			// Now we want to mark the buttons as selected
			if (jqmobile==1) {
				var hif;
				if (but_id.substr(-1,1) =="0") hif = but_id.slice(0,-1)+"1"; 
				else 						hif = but_id.slice(0,-1)+"0";
				$( "#"+hif ).removeClass( 'hover' );
				$( this ).addClass ( 'hover' );
			}
			else {
				// parents are the <td>, their siblings the other <td>, the children of <td> are the "<input> elements
				$( this ).parent().siblings().children().removeClass( 'hover' );
				$( this ).addClass ( 'hover' );
			}

			// This will return ALL classes for button attribute
			button_class = $(e.target).parent().parent().attr('class');
			
			// Update the slider of the dimmer to match the button pressed
			if (button_class == 'devrow dimrow' )
			{
				// dimmer specific button
				var slid_id="#" + id +"Fd";			
				value = load_device(s_room_id, id);
				// If lamp is OFF, set the slider to left position. Use slider value 0 for this.
				if ( value == "OFF" ) { value = 0; }
				
				if ( jqmobile==1 ) {
					$ ( slid_id ).val( value ) ;
					$ ( slid_id ).slider("refresh");			// Needed for jQuery mobile to actualize sliders
				}
				else {
					
					// Set the slider in the right position after button press (either most left, or on last value)
					$( slid_id ).slider("option", "value", value );
					// Set the input label field also on correct value
					var label="#"  + id +"Fl";
					$ ( label ).val( value ) ;
					// alert("init_lamps:: class: "+button_class+"\nslid_id"+ slid_id + "\nvalue: "+value+"\nlabel: "+label);
				}
			} else
			{
			// This is a regular button. if there are special commands for this situation they go here

			}
		}); // End of button Handler
		
		// SORTABLE
		// Make the table sortable. It allows us to define a table with buttons above that are 
		// Not sortable but still look quite the same as these ... And for button handling it does
		// not see the difference.
		if (jqmobile == 1) {								// For jqmobile make a different sortable (later)
		
			// *** NOT IMPLEMENTED YET FOR MOBILE ***
		
		}
		else
		{// Sortable works different for mobile and webbased
			var start_pos;
			$("#gui_devices tbody").last().sortable({

			start: function (event, ui) {
            	$(ui.item).data("startindex", ui.item.index());
				start_pos = ui.item.index();
				console.log( "Start pos: " + start_pos );
        	},
			// NOTE: index 0 contains the header and is undefined, DO NOT USE IT
			stop: function (event, ui) {
				var mylist;
				var stop_pos = ui.item.index();
				var stop_index;
				var start_index;
				//console.log( "Start pos: " + start_pos );
				//console.log( "Stop pos: " + stop_pos  );
				
				console.log( "start_pos: "+start_pos+", stop_pos: "+stop_pos);
            	//self.sendUpdatedIndex(ui.item);
				j=0;
				for (var i=0; i<devices.length; i++) {
						if (devices[i]['room'] != s_room_id) {		// Find next device in THIS room
							continue;
						}
						if (j==start_pos) { 
							start_index = i;
						}
						else if (j== stop_pos) {
							stop_index = i;
						}
						j++;
				}//for
				console.log( "room: "+s_room_id+",start_index: "+start_index+", stop_pos: "+stop_index);
				// start_index en stop_index contain idexs of the elements
				// that will be involved in the move !!
				var removed = devices.splice(start_index,1);
				console.log( "name removed: "+removed[0]['name']);
				var effe = devices.splice(stop_index,0,removed[0]);
				
        	}// stop 
		}).disableSelection();
		// Sorting done, updated the devices array to reflect the changes, 
		
		// Need to update the database (ever)!
		
	}//else
} // activate_room


// ---------------------------------------------------------------------------------------
//
// Change a scene based on the index of the menu button pressen on top of page
// For each secen we record a set of user actions.
// For the moment we can show the complete sequence, delete it and/or record a new sequence
//
function activate_scene(scn)
{
	$( "#gui_content" ).empty();
	
	html_msg = '<div id="gui_scenes"></div>';
	$( "#gui_content" ).append (html_msg);
	
	var offbut, onbut;	
		// For all devices, write all to a string and print string in 1 time
	for (var j = 0; j<scenes.length; j++ )
	{
		
		var scene_id = scenes[j]['id'];		
		if (scn == scene_id )
		{
			if (debug > 2) alert("Activate_screen:: Making buttons for scene: " + scene_id);
			// Start a table for the control buttons
			html_msg = '<table border="0">';
			$( "#gui_scenes" ).append( html_msg );
	
			var table = $( "#gui_scenes" ).children();		// to add to the table tree in DOM
			var scene_name = scenes[j]['name'];
			var scene_seq = scenes[j]['seq'];
			// alert("activate_scene:: id:"+scene_id+"\nname: "+scene_name+"\nSeq: "+scene_seq);
			// By making first row head, we make it non sortable as well!!
			var but =  '<thead>'	
					+ '<tr class="switch">'
					+ '<td colspan="2">'
					+ '<input type="submit" id="Fx'+scene_id+'" value="X" class="dbuttons del_button">'
					+ '<input type="submit" id="Fr'+scene_id+'" value="+" class="dbuttons new_button">'
					+ '<input type="submit" id="Fq'+scene_id+'" value=">" class="dbuttons play_button">'
					+ '</td>'
					+ '<td colspan="2"><input type="input"  id="Fl'+scene_id+'" value= "'+scene_name+'" class="dlabels"></td>' 
					
					+ '<td><input type="submit" id="Fc'+scene_id+'" value="STOP" class="dbuttons">'
					+ '<input type="submit" id="Fe'+scene_id+'" value="Store" class="dbuttons"></td>'
					+ '</thead>'
					;
			$(table).append(but);
			$(table).append('<tbody>');
			
			if (scene_seq != "")  {									// Test for empty array
			  var scene_split = scene_seq.split(',');				// If NO elements found, it still retuns empty array!!
			  for (var k = 0; k < scene_split.length; k+=2 )
			  {
				var ind = ((k/2)+1);			// As k is always even, the result will be rounded to integer
				
				// scene sequence: !FeP"name"=,!R1D1F1,00:00:15,!R1D2F1,00:00:05, .......
				// So we need to split the sequence by the comma and then display 2 lines for every command
				var scmd = decode_scene_string( scene_split[k] );
				var stim = decode_scene_string( scene_split[k+1]);
				but = '<tr class="scene">'
					+ '<td><input type="checkbox" id="s'+scene_id+'c" name="cb'+ind+'" value="yes"></td>'
					+ '<td> ' + ind
					+ '<td><input type="input" id="Fs'+scene_id+'i'+ind+'" value= "'+scene_split[k]+'" class="dlabels sval"></td>'
					+ '<td><input type="text" id="Ft'+scene_id+'t'+ind+'" value= "'+scene_split[k+1]+'" class="dbuttons sval"></td>'
					+ '<td>' + scmd 
					;
				$(table).append(but);
			  } // for
			}// if
			else {
				ind=0;												// First in row
			}
			
			// If we were recording actions, this is the moment to add a new command to the 
			// Scene or sequence 
			
			if (s_recording == 1) {
				
				scmd = decode_scene_string(s_recorder);
				
				// Return here as there is no device to handle
				
				console.log("Need to decode s_recorder");
				// Should we do this, or keep on recording until the user presses the recording button again?
				s_recording = 0;
				ind++;												// If list was empty, ind was 0, becomes 1

				but = '<tr class="scene">'
					+ '<td><input type="checkbox" id="s'+scene_id+ 'c" name="cb' + ind +'" value="yes"></td>'
					+ '<td>' + ind
					+ '<td><input type="input" id="Fs'+scene_id+'i'+ind+'" value= "'+s_recorder+'" class="dlabels sval"></td>'
					+ '<td><input type="text" id="Ft'+scene_id+'t'+ind+'" value= "'+"00:00:10"+'" class="dbuttons sval"></td>'
					+ '<td colspan="2">' + scmd 
					;
				$(table).append(but);
				
				// Make sure to sync the new record to the array
				// Or should we use the global var s_scene_id?
				if (ind == 1) {
					// First device in the scene.seq
					scenes[j]['seq'] = s_recorder + ",00:00:10";
				}
				else {
					// All other device commands are separated with a ","
					scenes[j]['seq']+= "," + s_recorder + ",00:00:10";
				}
				
			    if (debug>2) alert("Recorder adding:: j: "+j+", s_scene_id: "+s_scene_id+"\n"
					  + "\n id: "+scenes[j]['id']+"\nval: "+scenes[j]['val']
					  + "\n name: "+scenes[j]['name']+"\nseq: "+scenes[j]['seq']);
				
				
				// If this is the first line in the scene database
				send_2_dbase("upd_scene", scenes[j]);
				message("Device command added to the scene");
				
			} // if recording

			// We have to setup an event handler for this screen.
			// After all, the user might like to change things and press some buttons
			// NOTE::: This handler runs asynchronous! So after click we need to sort out for which scene :-)
			// Therefore, collect all scene data again in this handler.
			//
			$( "#gui_scenes" ).on("click", ".dbuttons" ,function(e) 
			{
				e.preventDefault();
//				e.stopPropagation();
				value=$(this).val();									// Value of the button pressed (eg its label)
				var but_id = $(e.target).attr('id');					// id of button
				// var scene_id = $(e.target).attr('id').substr(2,1);	// XXX Assuming scene Id is one digit
				// but also s_scene_id tells us which scene is active
				
				var scene = get_scene(s_scene_id);
				//alert("s_scene_id: "+s_scene_id+", scene[id]: "+scene['id']);
				
				var scene_name = scene['name'];
				var scene_seq = scene['seq'];
				var scene_split = scene_seq.split(',');					// Do in handler
			
			// May have to add: Cancel All timers and Delete All timers
				switch (but_id.substr(0,2))
				{
					// START button, queue scene
					case "Fq":
						// Send to the device message_device
						var scene_cmd = '!FqP"' + scene['name'] + '"';
						// Send to device. In case of a Raspberry, we'll use the backend_rasp
						// to lookup the command string from the database
						message_device("scene", scene_cmd );

					break;
					
					// STORE button
					case "Fe":
						var scene_cmd = '!FeP"' + scene['name'] + '"=' + scene['seq'];
						
						// alert("Fe Storing scene:: "+scene_cmd);
						// Send to database and update the current scene record
						send_2_dbase("upd_scene", scene);
						
						// Send to controller (necessary for the ICS-1000)
						message_device("scene", scene_cmd );
					break;
						
					// DELETE scene action, ONE of the actions in the seq!!!
					case "Fx":
						if (debug > 2) alert("Activate_screen:: Delete Fx button pressed");
						var msg = "Deleted actions ";
						// Go over each TR element with id="scene" and record the id
						// We need to go reverse, as removing will mess up higher indexes above,
						// this will not matter if we work down the array
						$($( "#gui_scenes .scene" ).get().reverse()).each(function( index ) {
																
							var id = 	$(this ).children().children('.dlabels').attr('id');		
							var ind = parse_int(id)[1];			// id contains two numbers in id, we need 2nd
						
							if ( $(this ).children().children('input[type="checkbox"]').is(':checked') ) {

								if (debug > 1) alert ("delete scene id: "+id+", index: "+ind+" selected");
								var removed = scene_split.splice(2*(ind-1),2);
								ind --;							// After deleting from scene_split, adjust the indexes for
																// rest of the array	
								if (debug > 1) alert("removed:"+removed[0]+ "," +removed[1]+": from seq: "+scene_split );
								msg += ind + " : " + decode_scene_string( removed[0] ) + "; " ;
							}
						});
						message(msg);
						// We need to find the index of array scenes to update. As we are in a handler
						// we cannot rely on the j above but need to find the index from 'id' field in scenes
						
						for (var j=0; j<scenes.length; j++) {
							if (scenes[j]['id'] == s_scene_id ) {
								// Now concatenate all actions and timers again for the scene_split
								if (typeof(scene_split) == "undefined") {
									if (debug>2) alert("activate_scene:: case FX: scene_split undefined");
								}
								else {
									scenes[j]['seq']=scene_split.join();
									if (debug>2) alert("seq: " + scenes[j]['seq']);
								}
								break;
							}
						}
								
						// We will NOT store to the dabase unless the user stores the sequence by pressing the STORE button
						activate_scene(s_scene_id);
												
					break;

					// CANCEL scene button
					case "Fc":
					// Do we want confirmation?
						var scene_cmd = '!FcP"' + scene['name'] + '"';
						alert("Cancel current Sequence: " + scene['name']
							+ "\nScene cmd: " + scene_cmd
							);
						message_device("scene", scene_cmd);
					break;
					
					// Recording
					case "Fr":
						if (debug > 2) alert("Activate_screen:: Add Fr button pressed, start recording ...");
						myConfirm('You are about to add a new action to the scene. If you continue, the system ' 
						+ 'will be in recording mode until you have selected a device action. Then you are returned '
						+ 'to this scene screen again. Please confirm if you want to add a device. ', 
						// Confirm
						function () {
							// DO nothing....
							// Maybe make the background red during device selection or blink or so
							// with recording in the message area ...
							message('<p style="textdecoration: blink; background-color:red; color:white;">RECORDING</p>');
						
							// Cancel	
  							}, function () {
								s_recording = 0;
								return(1); // Avoid further actions for these radio buttons 
  							},
  							'Adding a Device action?'
						);
						s_recording = 1;							// Set the recording flag on!
						s_recorder = "";							// Empty the recorder
						init_rooms("init");
					break;
					
					// Change a timer value in the scene screen
					case "Ft":
	// XXX MMM In LamPI, Scene id can be higher than 9, thus 2 chars (make function read_int(s,i) )
						
						var val= $(e.target).val();
						//alert("scene current time val is: "+val);
						
						var hh=""; for(i=00;i<24;i++) {
							if (i==val.substr(0,2)) hh +='<option selected="selected">'+("00"+i).slice(-2)+'</option>';
							else hh +='<option>'+("00"+i).slice(-2)+'</option>';
						}
						var mm=""; for(i=00;i<60;i++) {
							if (i==val.substr(3,2)) mm +='<option selected="selected">'+("00"+i).slice(-2)+'</option>';
							else mm +='<option>'+("00"+i).slice(-2)+'</option>';
						}
						var ss=""; for(i=00;i<60;i++) {
							if (i==val.substr(6,2)) ss +='<option selected="selected">'+("00"+i).slice(-2)+'</option>';
							else ss +='<option>'+("00"+i).slice(-2)+'</option>';
						}
						var ret;
						var frm = '<form id="addRoomForm"><fieldset>'
							+ '<p>You can change the timer settings for this action. Please use hh:mm:ss</p>'
							+ '<br />'
							+ '<label style="width:50px;" for="val_1">hrs: </label>'
							+ '<select id="val_1" value="'+val.substr(0,2)+'" >' + hh +'</select>'
							+ '<label style="width:50px;" for="val_2">mins: </label>'
							+ '<select id="val_2" value="' + val.substr(3,2)+ '">' + mm +'</select>'
							+ '<label style="width:50px;" for="val_3">secs: </label>'
							+ '<select id="val_3" selectedIndex="10" value="'+ val.substr(6,2)+'">' + ss +'</select>'
							+ '</fieldset></form>'
							;	
						askForm(
							frm,
							function(ret){
							// OK Func, need to get the value of the parameters
							// Add the device to the array
							// SO what are the variables returned by the function???
							if (debug > 2) alert(" Dialog returned val_1,val_2,val_3: " + ret);
						
							// Value of the button pressed (eg its label)
							var laval = ret[0]+":"+ret[1]+":"+ret[2];
							$(e.target).val(laval);
							if (debug>2) alert("Timer changed from "+ val+" to: "+ $(e.target).val() );
						
						// Now change its value in the sequence string of timers also
						// use but_id= $(e.target).attr('id') to get the index number ...							
							var ids = parse_int(but_id);					// Second number is gid, first scene_id
							var gid = ids[1];
							scene_split [((gid-1)*2) + 1] = laval;
							
							var my_list = '';
							// Go over each element and assemble the list again.
							$( "#gui_scenes .scene" ).each(function( index ) {
								var id = 	$(this ).children().children('.dbuttons').attr('id');	
								// parse_int can handle multi-digit numbers in id's!!
								var ind = parse_int(id)[1];
								console.log( "scn: " + scn + " html index: " + index + " scene ind: " + ind );
								my_list += scene_split [(ind-1)*2] + ',' + scene_split [((ind-1)*2) + 1] + ',' ;
							});
							// Now we need to remove the last ","
							console.log("my_list :" + my_list);
							my_list = my_list.slice(0,-1);
							console.log("scene: " + s_scene_id + ", " + scenes[s_scene_id-1]['name'] + ", my_list: " + my_list );
							// XXX OOPS, not nice, should look up the index, not assume ind[id==1] is same as array index 0
							scenes[s_scene_id-1]['seq'] =  my_list;
							if (debug>2) alert("new scene_list:: "+my_list);
							return (0);	
  						},
						function () {
							return(1); // Avoid further actions for these radio buttons 
  						},
  						'Confirm Change'
					); // askForm
					break;
					
					default:
						alert("Sequence action unknown: " + but_id.substr(-2) );
				}
			})
		}
	}
	// ------SORTABLE---REQUIRES MORE WORK -------
	// Sortable put at the end of the function
	// The last() makes sure only the second table is sortable with the scene elements
	
	// Note: Unsure if we should use scene_split var, as this function is async!
	// however, scene_split is in the scope of this function, and contains the
	// scurrent values on the screen...... but it works!
	if (jqmobile == 1) {
		
		// jmobile scenes NOT sortable at the moment
		
	}
	else {
	  $("#gui_scenes tbody").sortable({

		start: function (event, ui) {
            $(ui.item).data("startindex", ui.item.index());
        },
		// Make sure we select the second table!
		stop: function (event, ui) {

			var my_list = '';
			// Go over each element and record the id
			$( "#gui_scenes .scene" ).each(function( index ) {
				var id = 	$(this ).children().children('.dbuttons').attr('id');	
				// XXX Assumption that scene id is only 1 digit!!
				var ind = id.substr(4);
			// MMM	
				console.log( "scn: " + scn + " html index: " + index + " scene ind: " + ind );
				
				my_list += scene_split [(ind-1)*2] + ',' + scene_split [((ind-1)*2) + 1] + ',' ;
			});
			// Now we need to remove the last ","
			console.log("my_list :" + my_list);
			my_list = my_list.slice(0,-1);
			console.log("scene: " + scn + ", " + scenes[scn-1]['name'] + ", my_list: " + my_list );
			// XXX OOPS, not nice, should look up the index, not assume ind[1] is same as array index 0
			scenes[scn-1]['seq'] =  my_list;
        }	 
	  }).disableSelection();
	}
	
	s_scene_id = scn;
} // activate scene



// ---------------------------------------------------------------------------------------
//
// Change a handset based on the index of the menu button pressen on top of page
// For each handset we record a scene per button.
//
function activate_handset(hset)
{
	$( "#gui_content" ).empty();
	
	html_msg = '<div id="gui_handsets"></div>';
	$( "#gui_content" ).append (html_msg);
	
	var offbut, onetime, onbut;
	// For all handsets, write all to a string and print string in 1 time
	onetime=0;
	for (var j= 0; j<handsets.length; j++ )
	{
		var handset_id = handsets[j]['id'];	
		// If the definition is for the active handset handset_id
		if (hset == handset_id )
		{
			if (debug > 2) alert("Activate_handset:: Making buttons for handset: " + handset_id);
			var handset_name  = handsets[j]['name'];
			var handset_scene = handsets[j]['scene'];
			var handset_addr   = handsets[j]['addr'];
			var handset_unit  = handsets[j]['unit'];
			var handset_val   = handsets[j]['val'];
			
			// Start a table for the control buttons
			// Since we have multiple records with the same id, do this only once
			if (onetime == 0) 								
			{
				html_msg = '<table border="0">';
				$( "#gui_handsets" ).append( html_msg );
	
				var table = $( "#gui_handsets" ).children();		// to add to the table tree in DOM
			
				// alert("activate_handset:: id:"+handset_id+"\nname: "+handset_name+"\nSeq: "+handset_seq);
				// By making first row head, we make it non sortable as well!!
				var but =  '<thead>'	
					+ '<tr class="switch">'
					+ '<td colspan="2">'
					+ '<input type="submit" id="Fx'+handset_id+'" value="X" class="dbuttons del_button">'
					+ '<input type="submit" id="Fr'+handset_id+'" value="+" class="dbuttons new_button">'
					// + '<input type="submit" id="Fq'+handset_id+'" value=">" class="dbuttons play_button">'
					+ '</td>'
					+ '<td colspan="2"><input type="input"  id="Fl'+handset_id+'" value= "'+handset_name+'" class="dlabels"> addr: '+handset_addr+'</td>' 
					+ '<td>'
					// + '<input type="submit" id="Fc'+handset_id+'" value="STOP" class="dbuttons">'
					+ '<input type="submit" id="Fe'+handset_id+'" value="Store" class="dbuttons"></td>'
					+ '</thead>'
					;
				$(table).append(but);
				$(table).append('<tbody>');
				onetime=1;												// Do not print the header row again.
			}
			
			// Output the buttons for this handset
			// Test for empty array
			if (handset_scene != "")  {	
			  //alert("Handset "+handset_name+", scene: <"+handset_scene+">");	// XXX
			  
			  var handset_split = handset_scene.split(',');			// If NO elements found, it still retuns empty array!!
			  for (var k = 0; k < handset_split.length; k+=2 )
			  {
				var ind = ((k/2)+1);			// As k is always even, the result will be rounded to integer
				var onoff; if (handset_val==0 ) onoff="off"; else onoff="on";
				// scene sequence: !FeP"name"=,!R1D1F1,00:00:15,!R1D2F1,00:00:05, .......
				// So we need to split the sequence by the comma and then display 2 lines for every command
				var scmd = decode_scene_string( handset_split[k]  );
				var stim = decode_scene_string( handset_split[k+1]);
				but = '<tr class="handset">'
					+ '<td><input type="checkbox" id="s'+handset_id+'c" name="cb'+ind+'" value="yes"></td>'
					+ '<td>But ' + handset_unit +' '+ onoff + '</td>'
					+ '<td><input type="input" id="Fs'+handset_id+'u'+handset_unit+'v'+handset_val+'i'+ind+'" value= "'+handset_split[k]+'" class="dlabels sval"></td>'
					+ '<td><input type="text" id="Ft'+handset_id+'u'+handset_unit+'v'+handset_val+'i'+ind+'" value= "'+handset_split[k+1]+'" class="dbuttons sval"></td>'
					+ '<td>' + scmd 
					;
				$(table).append(but);
			  } // for
			}// if
			else {
				ind=0;												// First in row
			}
			
			// If we were recording actions, this is the moment to add a new command to the 
			// Scene or sequence 
			
			if (s_recording == 1) {
				
				scmd = decode_scene_string(s_recorder);
				
				// Return here as there is no device to handle
				console.log("Decode s_recorder to: "+scmd);
				// Should we do this, or keep on recording until the user presses the recording button again?
				s_recording = 0;
				ind++;												// If list was empty, ind was 0, becomes 1

				but = '<tr class="handset">'
					+ '<td><input type="checkbox" id="s'+handset_id+ 'c" name="cb' + ind +'" value="yes"></td>'
					+ '<td>But ' + ind
					+ '<td><input type="input" id="Fs'+handset_id+'u'+handset_unit+'v'+handset_val+'i'+ind+'" value= "'+s_recorder+'" class="dlabels sval"></td>'
					+ '<td><input type="text" id="Ft'+handset_id+'u'+handset_unit+'v'+handset_val+'i'+ind+'" value= "'+"00:00:10"+'" class="dbuttons sval"></td>'
					+ '<td colspan="2">' + scmd 
					;
				$(table).append(but);
				
				// Make sure to sync the new record to the array
				// Or should we use the global var s_handset_id?
				if (ind == 1) {
					// First device in the scene.seq
					handsets[j]['scene'] = s_recorder + ",00:00:10";
				}
				else {
					// All other device commands are separated with a ","
					handsets[j]['scene']+= "," + s_recorder + ",00:00:10";
				}
				
			    if (debug>2) alert("Recorder adding:: j: "+j+", s_handset_id: "+s_handset_id+"\n"
					  + "\n id: "+handsets[j]['id']+"\nval: "+handsets[j]['val']
					  + "\n name: "+handsets[j]['name']+"\nseq: "+handsets[j]['scene']);
				
				
				// If this is the first line in the scene database
				send_2_dbase("upd_scene", handsets[j]);
				message("Device command added to the scene");
				
			} // if recording

			// We have to setup an event handler for this screen.
			// After all, the user might like to change things and press some buttons
			
		}// if a handset is s_handset_id
	}// for each handset
	
	
	
	// NOTE::: This handler runs asynchronous! No values above might be valid!!
	// So after click we need to sort out for which handler, which scene etc :-)
	// Therefore, collect all scene data again in this handler.
	//
	$( "#gui_handsets" ).on("click", ".dbuttons", function(e) 
	{
		e.preventDefault();
//		e.stopPropagation();
		value=$(this).val();									// Value of the button pressed (eg its label)
		var but_id = $(e.target).attr('id');					// id of button
		var cmd_id = parse_int(but_id)[0]; 
		//alert ("s_handset_id: " + s_handset_id + ", but_id: " + but_id + ", cmd_id: " + cmd_id);
		
		// id="Fx2u3v1"
		// First chars of the button id contain the action to perform
		// Then we have the id of the handset, followed by "u" and unit number
		// and "v"<value>
		switch (but_id.substr(0,2))
		{
			// START button, queue scene
			//
			//case "Fq":
			// Fq not used for handsets!!
				// Send to the device message_device
			//	var handset_cmd = '!FqP"' + handset['name'] + '"';
				// Send to device. In case of a Raspberry, we'll use the backend_rasp
				// to lookup the command string from the database
			//	message_device("handset", handset_cmd );

			//break;
					
			// STORE button, only for Raspi Controllers
			//
			case "Fe": // WWW works, 131120
				
				var handset = get_handset(s_handset_id);
				var handset_name = handset['name'];	
				
				// XXX We might have deleted handsets entries during delete that are NOT
				// deleted from the MySQL database. Need to keep these insync.
				// EITHER during store_hangset (first delete all records with this id, then add the new range)
				// OR by deleting these entries in the Fx section already....
				for (var j=0; j<handsets.length; j++) 
				{
					if (handsets[j]['id'] == s_handset_id) {
						console.log("Fe Storing handset:: "+handset_name+":"+handsets[j]['unit']+":"+handsets[j]['val'] );
						// Send to database and update the current scene record
						send_2_dbase("store_handset", handsets[j]);
					}
				}
				// Not Applicable for the ICS-1000 controller
				// So we need not to do the next lines for ICS-1000
				// var handset_cmd = '!FeP"' + handset['name'] + '"=' + handset['scene'];
				// message_device("scene", handset_cmd );
			break;

			//
			// DELETE handset line, ONE of the actions in the seq!!! for the button
			//	
			case "Fx": // WWW Works, 131120
	
				if (debug > 2) alert("Activate_handset:: Delete Fx button pressed" );
				// NOTE:: See activate_handset, if the last element of a scene is deleted, we have an
				// empty remote button defined without further action(s).
				// When ading new handset have to check for already existing empty handsets/buttons
				
				var msg = "Deleted actions ";
				// QQQ
				if (debug>0) {
					
					myConfirm('You are about to delete one or more button actions for this handset. '
					+ 'If you continue, all lines that you checked will be deleted from the system '
					+ 'and this will be synchronized with the database.\n'
					+ 'Please keep in mind that you will delete ALL lines that you checked and and its corresponding actions '
					, 
					// Confirm
					function () {
						// Confirm
						
						// Go over each TR element with id="handset" and record the id
						// We need to go reverse, as else removing will mess up higher indexes to come,
						// this will not be the case if we work down the array.
						// NOTE: Index == 0 for last element of array!!
						$($( "#gui_handsets .handset" ).get().reverse()).each(function( index ){
																
							var id    = $(this ).children().children('.dlabels').attr('id');
							var value = $(this ).children().children('.dlabels').attr('value');
					
							var handset_id   = parse_int(id)[0];
							var handset_unit = parse_int(id)[1];
							var handset_val  = parse_int(id)[2];
							var ind          = parse_int(id)[3];
					
							handset = get_handset_record(handset_id,handset_unit,handset_val);
							handset_scene = handset['scene'];
							var handset_split = handset_scene.split(',');				// Do in handler
					
							// Lookup value and put index in ind
							var ind = handset_split.indexOf(value);
							//
							// This part is different for handsets than it is for scenes!

							if ( $(this ).children().children('input[type="checkbox"]').is(':checked') ) {

								if (debug > 1) alert ("delete handset button: "+handset_name+
									"\nid: "+id+", scene ind: "+ind+" selected, index: "+index+
									"\nHandset id: "+handset_id+", unit: "+handset_unit+", val: "+handset_val+
									"\nScene: "+handset_scene
								);
						
								// Finding the index of the item and time to delete is difficult!
								var removed = handset_split.splice(ind,2);
								ind --;							// After deleting from handset_split, adjust the indexes for
														// rest of the array	
								if (debug > 1) alert("removed:"+removed[0]+ "," +removed[1]+": from seq: "+handset_split );
								msg += ind + " : " + decode_scene_string( removed[0] ) + "; " ;
						
								// Now updat the handsets array again to reflact the change
								// We need to find the index of array handsets to update. As we are in a handler
								// we cannot rely on the j above but need to find the index from 'id' field in handsets
				
								//alert("Updating id:unit:val: "+handset_id+":"+handset_unit+":"+handset_val);
								for (var j=0; j<handsets.length; j++) {
									if (   (handsets[j]['id']   == handset_id) 
										&& (handsets[j]['unit'] == handset_unit) 
										&& (handsets[j]['val']  == handset_val) )
									{
										// We found a match id,unit,val
										// Now concatenate all actions and timers again for the scene_split
										if (typeof(handset_split) == "undefined") {
											if (debug>2) alert("activate_handset:: case FX: handset_split undefined");
										}
										else {
											handsets[j]['scene']=handset_split.join();
											if (debug>2) alert("scene: " + handsets[j]['scene']);
										}
										break;
									}
								}// for
						
							}// if checkbox
						});//for all handsets on screen
				
						message(msg);
						activate_handset(s_handset_id);	
						
  					}, function () {
						// Cancel
							activate_handset(s_handset_id);	
							return(0); 					// Avoid further actions for these radio buttons 
  					},
  					'Continue Deleting Handet(s)?'
					);
				}
				// Do NOT store in dabase unless the user stores the sequence by pressing the STORE button
												
			break;

			//
			// ADD Recording, ADD
			//
			case "Fr":
				// FIRST!!! 
				// Make sure that one of the checkboxes is selected as we want to insert AFTER
				// If there are NO buttons at all, create one, other wise append to current button.
				// this entry
		// QQQ
				if (debug>=0){
					myConfirm('You are about to add one or more button actions for this handset. '
					+ 'If you continue, the system will add a new record AFTER a line that you checked. '
					+ 'Please do not check more than one line if you\'re adding actions. The system will take the first '
					+ 'line ONLY and discard other lines that are checked. \n'
					+ 'I you like to add new buttons, just check nothing and let the system guide you to selecting a new '
					+ 'button and a new action to the handset.'
					, 
					// Confirm
					function () {
						// Confirm
						
  						}, function () {
						// Cancel
							return(0); 					// Avoid further actions for these radio buttons 
  						},
  					'	Continue Adding Handet(s)?'
					);
				}
				// Display dialog box
				if (debug > 2) alert("Activate_handset:: Add Fr button pressed, start recording ...");
				myConfirm('You are about to add an action to this handset. If you continue, the system ' 
				+ 'will be in recording mode until you have selected a device action. Then you are returned '
				+ 'to this scene screen again. Please confirm if you want to add a device. ', 
				// Confirm
				function () {
					// DO nothing....
					// Maybe make the background red during device selection or blink or so
					// with recording in the message area ...
					message('<p style="textdecoration: blink; background-color:red; color:white;">RECORDING</p>');
					// Before we can records, let's hope we know where to insert the 
					// new action
					s_recording = 1;							// Set the recording flag on!
					s_recorder = "";							// Empty the recorder
					init_handsets("init");
					
					// Cancel	
  					}, function () {
						s_recording = 0;
						return(1); // Avoid further actions for these radio buttons 
  					},
  					'Adding a Device action?'
				);
			break;
			
			//
			// Change a time value in the handset screen. The time field is an input action field.
			//
			case "Ft":	// XXX Works 131122
			
				// This is the current value of the time field
				var val= $(e.target).val();
				
				//alert("scene current time val is: "+val);
				
				var hh=""; for(i=00;i<24;i++) {
					if (i==val.substr(0,2)) hh +='<option selected="selected">'+("00"+i).slice(-2)+'</option>';
					else hh +='<option>'+("00"+i).slice(-2)+'</option>';
				}
				var mm=""; for(i=00;i<60;i++) {
					if (i==val.substr(3,2)) mm +='<option selected="selected">'+("00"+i).slice(-2)+'</option>';
					else mm +='<option>'+("00"+i).slice(-2)+'</option>';
				}
				var ss=""; for(i=00;i<60;i++) {
					if (i==val.substr(6,2)) ss +='<option selected="selected">'+("00"+i).slice(-2)+'</option>';
					else ss +='<option>'+("00"+i).slice(-2)+'</option>';
				}
				var ret;
				var frm = '<form id="addRoomForm"><fieldset>'
					+ '<p>You can change the timer settings for this action. Please use hh:mm:ss</p>'
					+ '<br />'
					+ '<label style="width:50px;" for="val_1">hrs: </label>'
					+ '<select id="val_1" value="'+val.substr(0,2)+'" >' + hh +'</select>'
					+ '<label style="width:50px;" for="val_2">mins: </label>'
					+ '<select id="val_2" value="' + val.substr(3,2)+ '">' + mm +'</select>'
					+ '<label style="width:50px;" for="val_3">secs: </label>'
					+ '<select id="val_3" selectedIndex="10" value="'+ val.substr(6,2)+'">' + ss +'</select>'
					+ '</fieldset></form>'
					;	
				askForm(
					frm,
					function(ret){
					// OK Func, need to get the value of the parameters
					// Add the device to the array
					// SO what are the variables returned by the function???
					if (debug > 2) alert(" Dialog returned val_1,val_2,val_3: " + ret);
						
					// Value of the button pressed (eg its label)
					var laval = ret[0]+":"+ret[1]+":"+ret[2];
					$(e.target).val(laval);
					if (debug>2) alert("Timer changed from "+ val+" to: "+ $(e.target).val() );
						
					// Now change its value in the sequence string of timers also
					// use but_id= $(e.target).attr('id') to get the index number ...							
					var ids = parse_int(but_id);
					// 1st handset_id, 2nd number is unit, 3rd val
					var j;
					for (j=0; j<handsets.length; j++) {
						if (   (handsets[j]['id'] == ids[0] ) 
							&& (handsets[j]['unit'] == ids[1] )
							&& (handsets[j]['val'] == ids[2] ) ) {
							break;					
						}
					}
					// j contains the correct record index
					var handset_split = handsets[j]['scene'].split(',');
					var tid = $(e.target).attr('id');
					var sid = "Fs" + tid.substr(2);
					var sval = $( "#"+sid).val(); //xxx
					alert("tid: "+tid+", sid: "+sid+", sval: "+sval);
					
					// Lookup value and put index in ind
					var ind = handset_split.indexOf( sval );
					alert("split ind: "+ind);
					handset_split [ind+1] = laval;
					handsets[j]['scene']=handset_split.join();
					
					return (0);	
  				},
				function () {
					return(1); // Avoid further actions for these radio buttons 
  				},
  				'Confirm Change'
			); // askForm
			break;
					
			default:
				alert("Sequence action unknown: " + but_id.substr(-2) );
		}
	})// on-click handler XXX can be moved to document.ready part of the program
	
	
	// ------SORTABLE---REQUIRES MORE WORK -------
	// Sortable put at the end of the function
	// The last() makes sure only the second table is sortable with the scene elements
	
	// Note: Unsure if we should use scene_split var, as this function is async!
	// however, scene_split is in the scope of this function, and contains the
	// scurrent values on the screen...... but it works!
	if (jqmobile == 1) {
		
		// jmobile handsets NOT sortable at the moment
		
		
		
	}
	else {
	  $("#gui_handsets tbody").sortable({

		start: function (event, ui) {
            $(ui.item).data("startindex", ui.item.index());
        },
		// Make sure we select the second table!
		stop: function (event, ui) {

			var my_list = '';
			// Go over each element and record the id
			$( "#gui_handsets .scene" ).each(function( index ) {
				var id = 	$(this ).children().children('.dbuttons').attr('id');	
				// XXX Assumption that scene id is only 1 digit!!
				var ind = id.substr(4);
			// MMM	
				console.log( "scn: " + hset + " html index: " + index + " scene ind: " + ind );
				
				my_list += scene_split [(ind-1)*2] + ',' + scene_split [((ind-1)*2) + 1] + ',' ;
			});
			// Now we need to remove the last ","
			console.log("my_list :" + my_list);
			my_list = my_list.slice(0,-1);
			console.log("scene: " + hset + ", " + handsets[hset-1]['name'] + ", my_list: " + my_list );
			
			// XXX OOPS, not nice, should look up the index, not assume ind[1] is same as array index 0
			handsets[hset-1]['scene'] =  my_list;
        }	 
	  }).disableSelection();
	}//else
	
	s_handset_id = hset;
} // activate handset


// ------------------------------------------------------------------------------
// Activate Timer
// 
// Let the user specify timing parameters for execution of a particular Scene
// Next to the obvious startdate/emdate and a timer settings it also allows
// complex timing setting such as sunrise/sunset and block out days or months 
// in the timing
// 
function activate_timer(tim)
{
	if (debug>2) alert("activate_timer");
	$( "#gui_content" ).empty();
	
	html_msg = '<div id="gui_timers"></div>';
	$( "#gui_content" ).append (html_msg);
	
	var offbut, onbut;	
		// For all devices, write all to a string and print string in 1 time
	for (var j = 0; j<timers.length; j++ )
	{
		
		var timer_id = timers[j]['id'];		
		if (tim == timer_id )
		{
			var timer = timers[j];
			// Start a table for the control buttons
			html_msg = '<table border="0">';
			$( "#gui_timers" ).append( html_msg );
	
			var table = $( "#gui_timers" ).children();		// to add to the table tree in DOM
			var timer_name = timers[j]['name'];
			
			// alert("activate_timer:: id:"+timer_id+"\nname: "+timer_name+"\nSeq: "+timer_seq);
			
			// By making first row head, we make it non sortable as well!!
			// Here we define the header row with the edit buttons
			var but =  '<thead>'	
					+ '<tr class="switch">'
					+ '<td><input type="submit" id="'+timer_id+'Fe" value="Store" class="dbuttons play_button" style="min-width:100px;"></td>'
					
					// + '<input type="submit" id="' + timer_id + 'Fq" value=">" class="dbuttons play_button" >'
					+ '</td>'
					+ '<td><input type="input"  id="'+timer_id+'Fl" value="'+timer_name+'" class="dlabels"></td>' 
					+ '<td>'
					//+ '<input type="submit" id="' + timer_id + 'Fx" value="X" class="dbuttons del_button" >'
					//+ '<input type="submit" id="' + timer_id + 'Fr" value="+" class="dbuttons new_button" >'
					+ '</thead>'
					;
			$(table).append(but);
			$(table).append('<tbody>');

			// SELECT SCENE. First the scene selected 
			var str  = '<tr>' ;
				str += '<td><label for="scene">Select Scene: </label></td>' ;
				str	+= '<td><select id="scene" value="scene" style="font-size:normal;" class="dlabels">' ; 
			for (i=0; i< scenes.length; i++) {
				if (scenes[i]["name"] == timer['scene'] ) {
					str += '<option class="dlabels" value="'+scenes[i]["name"]+'" selected>' +scenes[i]["name"]+ '</option>';
				} else {
					str += '<option class="dlabels" value="'+scenes[i]["name"]+'" >' +scenes[i]["name"]+ '</option>';
				}
			}
			str += '</select></td>'
			// Now we have option info, we can build the form
			but = '<tr class="timer">'
					+ '<form><fieldset name="scene_select">'
					+ str
					+ '<br />'
					+ '</fieldset></form>' 	
				;
			$(table).append(but); 
			
			// SELECT Start Time
			var spl = timer['tstart'].split(":");
			// Label
			var str1 = '<tr><td><label for="tstart">Start time: </label></td>'
			// Value box
			var str2  = '<td><input type="text" id="Tv" value= "';
			switch (spl[0]) {
				// Sunrise - min * 30 
				case "96":
					str2 += "Sunrise - "+spl[1]*30 +" minutes";
				break;
				// Sunrise + min * 30
				case "97":
					str2 += "Sunrise + "+spl[1]*30+" minutes";
				break;
				// Sun Dawn - min * 30
				case "98":
					str2 += "Sunset - "+spl[1]*30+" minutes";
				break;
				// Sundawn + min * 30
				case "99":
					str2 += "Sunset + "+spl[1]*30+" minutes";
				break;
				// Regular Time notation
				default:
					str2 += ("00"+spl[0]).slice(-2)+":"+("00"+spl[1]).slice(-2);
			}
			str2 += '" class="dlabels sval" style="width:120px;">';				// Just label value
			//str2 += '" class="dlabels dbuttons" style="width:150px;">';		// clickeable
			str2 += '</td>';
			
			str3  = '<td>';
			str3 += '<input type="submit" id="Ts" value="Time" class="dbuttons timbut">';
			str3 += '<input type="submit" id="Tr" value="SunRise" class="dbuttons timbut" >';
			str3 += '<input type="submit" id="Td" value="SunSet" class="dbuttons timbut" >';
			str3 += '</select></td>';
			
			// Now we have option info, we can build the form
			but = '<tr class="timer">'
				+ str1
				+ str2
				+ '<form><fieldset>'
				+ str3
				+ '<br />'
				+ '</fieldset></form>' 
				+ '</tr>'
				;
			$(table).append(but); 
			//
			// Highlight the correct button
			$( '.timbut' ).removeClass( 'hover' );
			if ((spl[0]=="96") || (spl[0]=="97")) { $('#Tr').addClass( 'hover' ); }
			else if ((spl[0]=="98") || (spl[0]=="99")) { $('#Td').addClass( 'hover' ); }
			else { $('#Ts').addClass( 'hover' ); }
			
			// SELECT STARTD
			// alert("timer startd: " + timer['startd']);
			str  = '<td>Start Date: </td>';
			// QQQ
			
			//alert("startd:: 20"+yy+mm+dd);
			if (jqmobile != 1) {
				str += '<td><input  class="dlabels" type="text" id="startd" value="'+timer['startd']+'"/></td>';
				but = '<tr class="timer">'
					+ '<form><fieldset>'
					+ str
					+ '</fieldset></form>'
					+'</tr>'
				;
				$(table).append(but); 
			 	$(function() {
					$( "#startd" ).datepicker({ dateFormat: "dd/mm/yy" });
				});
			}
			else { // jqmobile version not yet released ..
				var dd = timer['startd'].substr(0,2);
				var mm = timer['startd'].substr(3,2);
				var yy = timer['startd'].substr(6,2);
				str += '<td><input  class="dlabels" type="text" min="2013-12-15" id="startd" value="20'+yy+'-'+mm+'-'+dd+'"/></td>';
				but = '<tr class="timer">'
					+ '<form><fieldset>'
					+ str
					+ '</fieldset></form>'
					+'</tr>'
				;
				$(table).append(but); 
				startd = $("#startd").mobipick({
        				dateFormat: "dd/MM/yy"
    			});
				startd.on("change",function() {
						timer['startd']= $( "#startd").val();
						alert("startd:: "+timer['startd']);
				});
			 	//$(functirt("res:: "+res);on() {
				//	$( "#startd" ).datepicker({ dateFormat: "dd/mm/y" });
				//});
			}
			
			// SELECT ENDD
			// alert("timer endd: " + timer['endd']);
			str  = '<td>End Date: </td>';
			if (jqmobile != 1) {
				str += '<td><input  class="dlabels" type="text" id="endd" value="'+timer['endd']+'"/></td>';
				but = '<tr class="timer">'
					+ '<form><fieldset>'
					+ str
					+ '</fieldset></form>'
					+'</tr>'
				;
				$(table).append(but); 
			 	$(function() {
					$( "#endd" ).datepicker({ dateFormat: "dd/mm/y" });
				});
			}
			else {
				var dd = timer['endd'].substr(0,2);
				var mm = timer['endd'].substr(3,2);
				var yy = timer['endd'].substr(6,2);
				str += '<td><input  class="dlabels" type="text" min="2013-12-15" id="endd" value="20'+yy+'-'+mm+'-'+dd+'"/></td>';
				but = '<tr class="timer">'
					+ '<form><fieldset>'
					+ str
					+ '</fieldset></form>'
					+'</tr>'
				;
				$(table).append(but); 
				endd = $('#endd').mobipick({
        				dateFormat: "dd/MM/yy"
    			});
				endd.on("change",function() {
					timer['endd']= $( "#endd").val();
				});
			}
			
			// Now we need to setup days of the week
			str  = '<td colspan="3"><br /><div class="days">' ;   	
			var dd = [ 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun' ];
			for (var i=0; i<7 ;i++) {	
				if ( timer['days'].substr(i,1) != 'x' ) {
					str += ' '+dd[i]+'<input type="checkbox" id="'+i+'" name="'+dd[i]+'" value="'+i+'" checked="checked" >';
				}
				else {
					str += ' '+dd[i]+'<input type="checkbox" id="'+i+'" name="'+dd[i]+'" value="'+i+'" >';
				}
			}
			str += '</div></td>';
			but  = '<tr><td colspan="3"><p>On what days of the week?</p></td></tr>';
			but += '<tr class="timer">' + str +'<br></tr>' ;
			$(table).append(but);
			
			// Now we need to setup Months selected
			str  = '<tr><td colspan="3"><a>What months should the timer run?</a></td></tr>';
			str += '<tr class="timer"><td colspan="3"><br /><div class="months">';   	
			var mm = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ];
			for (var i=0; i<12 ;i++) {	
				if ( timer['months'].substr(i,1) != 'x' ) {
					str +=' '+mm[i]+'<input type="checkbox" id="'+i+'" name="'+mm[i]+'" value="'+i+'" checked="checked">' ;
				}
				else {
					str +=' '+mm[i]+'<input type="checkbox" id="'+i+'" name="'+mm[i]+'" value="'+i+'">' ;
				}
			}
			str += '</div></td><br></tr>';
			$(table).append(str); 
			
			// We have to setup am event handler for this screen.
			// After all, the user might like to change things and press some buttons
			// NOTE::: This handler runs asynchronous! So after click we need to sort out for which device :-)
			//
			
			$( "#gui_timers" ).on("click", ".dbuttons" ,function(e) 
			{
				e.preventDefault();
//				e.stopPropagation();
				value=$(this).val();									// Value of the button pressed (eg its label)
				var but_id = $(e.target).attr('id');					// id of button
			
				// s_timer_id tells us which timer is active
				var timer = get_timer(s_timer_id);
				// May have to add: Cancel All timers and Delete All timers
				switch (but_id.substr(-2))
				{
					// START button
					//case "Fq":
					//	// Send to the device message_device
					//	var timer_cmd = '!FqP"' + timer['name'] + '"';
						// Send to device. In case of a Raspberry, we'll use the backend_rasp
						// file to lookup the command string from the database
					//	message_device("timer", timer_cmd );
					//break;
					
					//
					// STORE button !!! 
					// THIS ONE IS IMPORTANT. We'll LET THE USER PLAY UNTIL HE PRESSES THIS BUTTON!!!
					case "Fe":	
						var arr = $.map($('.days :input:checkbox:checked'), 
									function(e, i) {
        								return +e.value;
    							});
						//alert("days: " + arr);
						var res = "xxxxxxx";
						var mm  = "mtwtfss";
						for (var i = 0; i< arr.length; i++) {
							res = res.substr(0,arr[i]) + mm.substr(arr[i],1) + res.substr(arr[i]+1);
						}
						timer['days'] = res;
						
						var arr = $.map($('.months :input:checkbox:checked'), 
									function(e, i) {
        								return +e.value;
    							});
						// alert("month: " + arr);
						var res = "xxxxxxxxxxxx";
						var mm  = "jfmamjjasond";
						for (var i = 0; i< arr.length; i++) {
							res = res.substr(0,arr[i]) + mm.substr(arr[i],1) + res.substr(arr[i]+1);
						}
						timer['months'] = res;
						
						timer['scene'] = $("#scene").val() ;
						//timer['tstart'] = $("#Tv").val(); // XXX? timers is update for every change
						timer['startd'] = $("#startd").val();
						timer['endd'] = $("#endd").val();
						
						var str = ''
						+ 'STORE timer::\n'
						+ ", scene: " + timer['scene'] + "\n" 
						+ ", tstart: " + timer['tstart'] + "\n"			// ONly the hrs!!
						+ ", startd: " + timer['startd'] + "\n"
						+ ", endd: " + timer['endd'] + "\n"
						+ ", days: " + timer['days'] + "\n"				// Undefined
						+ ", months: " + timer['months'] + "\n"			// Undefined
						;
						// alert(str);
						send_2_dbase( "store_timer", timer); 
						
						// XXX Need to fix this for ICS-1000. At the moment we optimized so much for
						// Raspberry that these functions are gone for ICS
						
						// Send to controller
						//message_device("timer", timer_cmd );
					break;
						
					// DELETE timer button
					case "Fx":
					// Do we want confirmation?
						var timer_cmd = '!FxP"' + timer['name'] + '"';
						alert("Delete current Sequence: " + timer['name']
							+ "\ntimer cmd: " + timer_cmd
							  );
						message_device("timer", timer_cmd);
						// XXX Still need to delete something....
						// send_2_dbase( "delete_timer", timer);
					break;
					
					// Recording
					case "Fr":
						myConfirm('You are about to add a new action to the timer. If you continue, the system' 
						+ 'will be in recording mode until you have selected a device action. Then you are returned'
						+ 'to this timer screen again. Please confirm if you want to add a device.', 
						// Confirm
						function () {
							// DO nothing....
							// Maybe make the background red during device selection or blink or so
							// with recording in the message area ...
							message('<p style="textdecoration: blink; background-color:red; color:white;">RECORDING</p>');
						
							// Cancel	
  							}, function () {
								s_recording = 0;
								return(1); // Avoid further actions for these radio buttons 
  							},
  							'Adding a Timer action?'
						);
						s_recording = 1;							// Set the recording flag on!
						s_recorder = "";							// Empty the recorder
						init_rooms("init");
					break;
					
					// Timer Setting
					case "Ts":
						$( '.timbut' ).removeClass( 'hover' );
						$('#Ts').addClass( 'hover' );
						// Find the text field for input and to output to
						var val= $("#Tv").val();
						var hh=""; for (i=00; i<24; i++) {
							if (i==12) hh +='<option selected>'+("00"+i).slice(-2)+'</option>';
							else hh +='<option>'+("00"+i).slice(-2)+'</option>';
						}
						var mm=""; for (i=00; i<60; i++) mm +='<option>'+("00"+i).slice(-2)+'</option>';
			
						var ret=0;
						var frm='<form id="addRoomForm"><fieldset>'
							+ '<p>You can change the timer settings for this action. Please use hh:mm</p>'
							+ '<br />'
							+ '<label for="val_1">hrs: </label>'
							+ '<select id="val_1" value="'+val.substr(0,2)+ '" >' + hh +'</select>'
							+ '<label for="val_2">mins: </label>'
							+ '<select id="val_2" value="' + val.substr(3,2)+ '">' + mm +'</select>'
							+ '</fieldset></form>';
						askForm(
						frm,
						function (ret) {
							// OK Func, need to get the value of the parameters
							// Add the device to the array
							// SO what are the variables returned by the function???
							if (debug > 2) alert(" Dialog returned val_1,val_2,val_3: " + ret);
						
							// Value of the button pressed (eg its label)
							var laval = ret[0]+":"+ret[1];
							
							// Check the right target
							$("#Tv").val(laval);
							timer['tstart']=laval;
							if (debug>1) alert("Timer changed from "+ val+" to: "+ laval ); 
							// Need to put value back in Array timers
							set_timer(s_timer_id,timer);
							//return(0);	
  						}, 	
						// Cancel
						function () {
							//return(1); // Avoid further actions for these radio buttons 
  						},
  						"Confirm Change"
						);
					break;
					
					// Sunrise/Sundawn Timer Setting
					case "Tr":
						$( '.timbut' ).removeClass( 'hover' );
						$('#Tr').addClass( 'hover' );
						//alert ("SunRise button pressed");
						var val= $("#Tv").val();
						var mm=""; for (i=-04; i<5; i++) {
							if (i==0) mm += '<option selected>'+("00"+i).slice(-2)*30+'</option>';
							else mm += '<option>'+("00"+i).slice(-2)*30+'</option>';
						}
						var ret=0;
						var frm='<form id="addRoomForm"><fieldset>'
							+ '<p>Setting the timer to start at SunRise</p>'
							+ '<br />'
							+ '<label for="val_1">Sunrise offset in minutes: </label>'
							+ '<select id="val_1" value="' + val.substr(3,2)+ '">' + mm +'</select>'
							+ '</fieldset></form>';
						askForm(
						frm,
						function (ret) {
							// OK Func, need to get the value of the parameters
							// Add the device to the array
							// SO what are the variables returned by the function???
							if (debug > 2) alert(" Dialog returned val_1,val_2,val_3: " + ret);
						
							// Value of the button pressed (eg its label)
							if (ret[0]<0) {
							
									laval = "SunRise - " + ret[0].substr(1) + " minutes";
									timer['tstart']="96:"+("00"+ret[0]/-30).slice(-2);
							}
							else {
									laval = "SunRise + " + ret[0] + " minutes";
									timer['tstart']="97:"+("00"+ret[0]/30).slice(-2);
							}
							
							// Check the right target
							$("#Tv").val(laval);
							if (debug>1) alert("Timer changed from "+ val+" to: "+ laval);
							 
							// write back new value to array object timers
							set_timer(s_timer_id,timer);
							//return(0);	
  						}, 	
						// Cancel
						function () {
							//return(1); // Avoid further actions for these radio buttons 
  						},
  						"Set Sunrise Timer"
						);
					break;
					
					// Sunset/Sundusk timing setting
					case "Td":
						$( '.timbut' ).removeClass( 'hover' );
						$('#Td').addClass( 'hover' );
						
						var val= $("#Tv").val();
						var mm=""; for (i=-04; i<5; i++) {
							if (i==0) mm += '<option selected>'+("00"+i).slice(-2)*30+'</option>';
							else mm += '<option>'+("00"+i).slice(-2)*30+'</option>';
						}
						var ret=0;
						var frm='<form id="addRoomForm"><fieldset>'
							+ '<p>Setting the timer to start at SunSet</p>'
							+ '<br />'
							+ '<label for="val_1">Sunset offset in minutes: </label>'
							+ '<select id="val_1" value="' + val.substr(3,2)+ '">' + mm +'</select>'
							+ '</fieldset></form>';
						askForm(
						frm,
						// Create
						function (ret) {
							// OK Func, need to get the value of the parameters
							// Add the device to the array
							// SO what are the variables returned by the function???
							if (debug > 2) alert(" Dialog returned val_1,val_2,val_3: " + ret);
						
							// Value of the button pressed (eg its label)
							if (ret[0]<0) {
							
									laval = "SunSet - " + ret[0].substr(1) + " minutes";
									timer['tstart']="98:"+("00"+ret[0]/-30).slice(-2);
							}
							else {
									laval = "SunSet + " + ret[0] + " minutes";
									timer['tstart']="99:"+("00"+ret[0]/30).slice(-2);
							}
							
							// Check the right target
							$("#Tv").val(laval);
							if (debug>1) alert("Timer changed from "+ val+" to: "+ laval);
							 
							// write back new value to array object timers
							if (set_timer(s_timer_id,timer) < 0)
								alert("Cannot set timer values in object");
							//return(0);	
  						}, 	
						// Cancel
						function () {
							//return(1); // Avoid further actions for these radio buttons 
  						},
  						"Set Sunset Timer"
						);
					break;
					
					// If we press the timevalue field (must be of class dbuttons to work)
					// Then start with either time of dusk value based upon which one is highlighted!
					case "Tv":
						// Which button is hover?
						// Do the appropriate action?
						if ( $( '#Ts' ).hasClass( "hover" ) ) {alert("Ts time")} ;
						if ( $( '#Tr' ).hasClass( "hover" ) ) {alert("Tr sunrise")} ;
						if ( $( '#Td' ).hasClass( "hover" ) ) {alert("Td sunsetk")} ;	
					break;
					
					default:
					// Could be users editing sequence in input field (yuk)
						alert("Sequence action unknown: "+but_id.substr(-2) );
				}
			})
		}
	}
	s_timer_id = tim;
	
} //activate_timer

// -------------------------------------------------------------------------------
// Activate the Settings screen for a certain setting
// identified with sid.
//
//
function activate_setting(sid)
{
	// Cleanup work area
	$( "#gui_content" ).empty();

	var offbut, onbut;	
	switch (sid)
	{
		// DEBUG level
		// Set the debug level and store in the settings variable
		case "0":
			html_msg = '<table border="0">';
			$( "#gui_content" ).append( html_msg );
	
			var table = $( "#gui_content" ).children();		// to add to the table tree in DOM
			var but =  ''	
					+ '<tr class="switch">'
					+ '<td>'
					+ 'Select the debug level: ' 
					+ '</td>'
					;
			$(table).append(but);
			but = ''	
					+ '<td>'
					+ '<span id="choice" class="buttonset">'
					+ '<input type="radio" name="choice" id="d0" value="0" class="buttonset" checked="checked"><label for="d0">L0</label>'
					+ '<input type="radio" name="choice" id="d1" value="1" class="buttonset" ><label for="d1">L1</label>'
					+ '<input type="radio" name="choice" id="d2" value="2" class="buttonset" ><label for="d2">L2</label>'
					+ '<input type="radio" name="choice" id="d3" value="3" class="buttonset" ><label for="d3">L3</label>'
					+ '</span></td>'
					;
			$(table).append(but);

			var debug_help = " <br>\
					This is some text to explain the use of the debug parameter. \
					During normal operation, the parameter should  be set to 0, which means no debug messages are displayed \
					and only a condensed set of status messages will be shown. \
						<li>Level 1: Will set debug level so that more messages are displayed in the message area \
						<li>Level 2: Will add popup alerts for the main things/buttons/events \
						<li>Level 3: All error and comment messages are displayed <br /><br> \
					";
			$(table).append('<tr><td><span>' + debug_help + '</span>');
			
			debug = settings[0]['val'];
			$('#choice').buttonset();
			
			$('#d'+ debug).attr('checked',true).button('refresh');
			$('#choice input[type=radio]').change(function() {
				debug = this.value;
				// XXX Ooops, should not update bsed on index but on id value
				settings[0]['val'] = debug;
				if (persist>0) {
						// Write the settings to database
						if (debug>0) myAlert("Set : " + settings[0]['name']+' to '+settings[0]['val'],"DEBUG LEVEL");
						send_2_dbase("store_setting", settings[0]);
				}
				message("debug level set to "+ debug);
			})
		
		break;
			
		// Controller Select
		// Select whether you want to use the ICS controller or the do-it-yourself of Raspberry PI
		case "1":
			html_msg = '<table border="0">';
			$( "#gui_content" ).append( html_msg );
	
			var table = $( "#gui_content" ).children();		// to add to the table tree in DOM
			var but =  ''	
					+ '<tr class="switch">'
					+ '<td>'
					+ 'Select which controller to use: ' 
					+ '</td>'
					;
			$(table).append(but);
			if (jqmobile==1) {
				but = '<td>'
				+ '<div data-role="controlgroup" data-type="horizontal">'
				+ '<input type="radio" name="choice" id="d0" value="0" class="buttonset" checked="checked"><label for="d0">ICS-1000</label>'
				+ '<input type="radio" name="choice" id="d1" value="1" class="buttonset"><label for="d1">Raspberry</label>'
				+ '</div></td>';
			}
			else {
				but = ''	
				+ '<td>'
				+ '<span id="choice" class="buttonset">'
				+ '<input type="radio" name="choice" id="d0" value="0" class="buttonset" checked="checked"><label for="d0">ICS-1000</label>'
				+ '<input type="radio" name="choice" id="d1" value="1" class="buttonset"><label for="d1">Raspberry</label>'
				+ '</span></td>'
				;
			}
			$(table).append(but);

			var debug_help = "<br> \
								This parameter describes which controller we will use to send lamp commands to the devices. \
								The ICS-1000 is a safe choice in case you have one. For users that have a Raspberry PI\
								and a 433 MHz transmitter (and implemented the commands as found in backend_rasp.php \
								it's much more fun to use the latter. Remember to pair your device with either or both.\
								<br /><br> \
					";
			$(table).append('<tr><td><span>' + debug_help + '</span>');	
			
			cntrl = settings[1]['val'];
			
			//alert("Before choice buttonset");
			if (jqmobile==1) {
				
				$('#d'+ cntrl).attr('checked',true).button('refresh');
				$( ".buttonset" ).bind( "click", function(e, ui) {
					cntrl = $(e.target).val();
 					//alert("button: "+cntrl);
					if (cntrl == 0) {
						alert ("Setting controller to ICS-1000");
						s_controller = murl + 'backend_ics.php';
					} else {
						alert ("Setting controller to Raspberry");
						s_controller = murl + 'backend_rasp.php';
					}
					message("Controller value value set to "+ cntrl);
					// XXX Ooops, we directly address the array here, as controller is second array element
					settings[1]['val'] = cntrl;
					if (persist>0) {
						// Write the settings to database
						send_2_dbase("store_setting", settings[1]);
					}
				});
			}
			else {
				$('#choice').buttonset();
				$('#d'+ cntrl).attr('checked',true).button('refresh');
			
				$('#choice input[type=radio]').change(function(e) {
					//cntrl = $(e.target).val();
					cntrl = this.value;
					//alert("cntrl: "+cntrl);
					if (cntrl == 0) {
						myAlert ("Setting controller to ICS-1000");
						s_controller = murl + 'backend_ics.php';
					} else {
						myAlert ("Setting controller to Raspberry");
						s_controller = murl + 'backend_rasp.php';
					}
					message("Controller value value set to "+ cntrl);
					// XXX Ooops, we directly address the array here, as controller is second array element
					settings[1]['val'] = cntrl;
					if (persist > 0) {
						// Write the settings to database
						if (debug>1) alert("Set : "+settings[1]['name']+' to '+settings[1]['val']);
						send_2_dbase("store_setting", settings[1]);
					}
				})	
			}
		break;

		// sql, do we want to make use of sql or sync to an array at the backend.
		// In this case, we either need to save to files (often) or only accept persist to be "relaxed"
		// For the moment, files are NOT supported in combination with persist == "Strict"
		case "2":
			html_msg = '<table border="0">';
			$( "#gui_content" ).append( html_msg );
	
			var table = $( "#gui_content" ).children();		// to add to the table tree in DOM
			var but =  ''	
					+ '<tr class="switch">'
					+ '<td>'
					+ 'Select SQL use or plain files: ' 
					+ '</td>'
					;
			$(table).append(but);
			but = ''	
					+ '<td>'
					+ '<span id="choice" class="buttonset">'
					+ '<input type="radio" name="choice" id="d0" value="0" class="buttonset"><label for="d0">Files</label>'
					+ '<input type="radio" name="choice" id="d1" value="1" class="buttonset" checked="checked"><label for="d1">SQL</label>'
					+ '</span></td>'
					;
			$(table).append(but);

			var debug_help = "<br> \
								This parameter describes what kind of storage we use on the backend. \
								The simplest solution is using files for storage, but then we will not be able to\
								synchronize all ations on the client with storage. <br><br>\
								At the moment, only MySQL is implemented! (and it works like a charm)\
								<br /><br> \
					";
			$(table).append('<tr><td><span>' + debug_help + '</span>');	

			mysql = settings[2]['val'];
			$('#choice').buttonset();
			$('#d'+ mysql).attr('checked',true).button('refresh');
			$('#choice input[type=radio]').change(function() {
					mysql = this.value;
					settings[2]['val'] = mysql;
					if (persist > 0) {
						// Write the settings to database
						if (debug > 0) alert("Set : " + settings[2]['name'] + ' to ' + settings[2]['val']);
						send_2_dbase("store_setting", settings[2]);
					}
					message("MySQL value set to "+ mysql);
			})		
		break;	
		
		// persistence	XXX At the moment not really used. Could be once we build the daemon process
		//
		case "3":
			html_msg = '<table border="0">';
			$( "#gui_content" ).append( html_msg );
	
			var table = $( "#gui_content" ).children();		// to add to the table tree in DOM
			var but =  ''	
					+ '<tr class="switch">'
					+ '<td>'
					+ 'Select persistence to the database: ' 
					+ '</td>'
					;
			$(table).append(but);
			but = ''	
					+ '<td>'
					+ '<span id="choice" class="buttonset">'
					+ '<input type="radio" name="choice" id="d0" value="0" class="buttonset"><label for="d0">Easy</label>'
					+ '<input type="radio" name="choice" id="d1" value="1" class="buttonset" checked="checked"><label for="d1">Relaxed</label>'
					+ '<input type="radio" name="choice" id="d2" value="2" class="buttonset"><label for="d2">Strict</label>'
					+ '</span></td>'
					;
			$(table).append(but);

			var debug_help = "<br> \
								This parameter deals with the persistence of the data to the SQL database. \
						<li>Easy: Button changes are locally saved, and will be remembered in this session. \
								Configuration changes to scenes/timers are saved to memory only. \
								Re-ordering buttons in sequences are cosmetic only, as soon as you move away from the page \
								changes are forgotten \
						<li>Relaxed: Changes in devices are remembered during the session and are written to the backend \
								changes in sequences are not. When other users use remotes or other jqmobile apps,\
								relaxed still has advantages, although remembering buttons settings between sessions is less useful\
						<li>Strict: As far as possible, every change in configuration data will be written to the \
								backend database. More traffic overhead, slower performance, but maximum consistency of \
								the database also between different webusers or sessions.\
					";
			$(table).append('<tr><td><span>' + debug_help + '</span>');	
			persist = settings[3]['val'];	
			$('#choice').buttonset();
			$('#d'+ persist).attr('checked',true).button('refresh');
			$('#choice input[type=radio]').change(function() {
					persist = this.value;
					settings[3]['val'] = persist;
					message("Persist value set to "+ persist);
					// For persist, we ALWAYS write this value to the database as
					// we have to remember this one (really)
					if (persist >= 0) {
						// Write the settings to database
						if (debug > 0) alert("Set : " + settings[3]['name'] + ' to ' + settings[3]['val']);
						send_2_dbase("store_setting", settings[3]);
					}
			});
			// Init the current value of the button
			
		break;
		
		// Since 1.4 we use it for skin/style selection
		// 
		case "4":
			$( "#gui_content" ).empty();
			html_msg = '<div id="gui_skin"></div>';
			$( "#gui_content" ).append (html_msg);

			html_msg = '<table border="0">';
			$( "#gui_skin" ).append( html_msg );
			
			var table = $( "#gui_skin" ).children();		// to add to the table tree in DOM
					
			var but =  ''	
					+ '<thead><tr class="switch">'
					+ '<td colspan="2">'
					+ 'Choose your Style/Skin setting ' 
					+ '</td></tr></thead>'
					;
			$(table).append(but);

			var skin_help = "This option allows you to set the skin for your LamPI application. ";
			skin_help += "It will allow you to make your own selection of skins in a /styles/yourskin.css file, ";
			skin_help += "and make it the style of choice for your setting.<br><br>";
			skin_help += "Note: Not supportted on mobile devices!<br>";
			skin_help += "Note: Better not choose a files for use on mobile devices ...<br><br>";
			
			$(table).append('<tr><td colspan="2"><span>' + skin_help + '</span>');		
				
			var list = [];
			var str = '<fieldset><label for="load_skin">Select File: </label>'
						+ '<select id="load_skin" value="styles/classic-blue.css" style="width:200px;" class="dlabels">' ; 
			var files = {};
			files = send_2_set("list_skin","*css");
			//str += '<option>' + '   ' + '</option>';
			for (var i=0; i<files.length; i++) {
					str += '<option>' + files[i] + '</option>';
			}
			str += '</select>';
			str += '</fieldset>';
			
			but = ''
					+ '<tr><td>'
					+ '<input type="submit" name="load_button" id="d1" value="load" class="dbuttons cc_button">'
					+ '<label for="d1">Load Configuration</label>'
					+ '<td><form action="">'
					+ str
					+ '</form>'
					+ '</td></tr>'
					;
			$(table).append(but);	
			// Handle the content of the Backup/Restore screen
			$( "#gui_skin" ).on("click", ".dbuttons" ,function(e) 
			{
				var skin_val = this.value;
				message("Skin selected "+ skin_val);
				switch ( skin_val ) {
						
					case "load":
						var skin_file = $( "#load_skin").val();
						// Trick!! only replace hrefs that start with our styles directory!!!
						$("link[href^='styles']").attr("href", skin_file);
						settings[4]['val']=skin_file;
						//alert("Settings 4: "+ settings[4]['val']);
						send_2_dbase("store_setting", settings[4]);
					break;
						
					default:
						myAlert("Unknown option for Skin/Styles Setting: "+bak);
				}
			})
			
			// XXX make sure we write this to the mysql backend too!
				
				
				
		break;	
		
		case "5": // Backup and Restore
		
			$( "#gui_content" ).empty();
			html_msg = '<div id="gui_backup"></div>';
			$( "#gui_content" ).append (html_msg);
		
			html_msg = '<table border="0">';
			$( "#gui_backup" ).append( html_msg );
	
			var table = $( "#gui_backup" ).children();		// to add to the table tree in DOM
			//html_msg = '<div id="gui_backup"></div>';
			//$( "#gui_content" ).append (html_msg);
			//alert("backup");
			// Create a few buttons and call backend_set.php directly!!
			// Cosmetically not the most beutiful solution but it works great for the moment
			var but =  ''	
					+ '<thead><tr class="switch">'
					+ '<td colspan="2">'
					+ 'What Backup or Restore action can we organize for you ' 
					+ '</td></tr></thead>'
					;
			$(table).append(but);
			
			var debug_help = "<br> \
						This page allows you to perform some backup and restore functions.<br>\
						It allows you to restore your database to a previous/known state,\
						for example if you messed up.<br>\
						Making regular backups of your configuration to file will greatly help \
						in restoring to a useful state if something goes wrong.<br /><br />\
						The database.cfg file is one of the default files for the system, \
						so please use another name for your backup.<br/><br/>\
						NOTE: At this moment we do not check for overwriting existing files.<br/>\
					";
			$(table).append('<tr><td colspan="2"><span>' + debug_help + '</span></td>');	

			var list = [];
			var str = '<fieldset><label for="load_config">Select File: </label>'
						+ '<select id="load_config" value="load" class="dlabels" style="width:200px;">' ;   // onchange="choice()"
			var files = {};
			files = send_2_set("list_config","*cfg");
			str += '<option>' + '   ' + '</option>';
			for (var i=0; i<files.length; i++) {
					str += '<option>' + files[i] + '</option>';
			}
			str += '</select>';
			str += '</fieldset>';
			
			but = ''
					+ '<tr><td>'
					+ ''
					+ '<input type="submit" name="store_button" id="d0" value="store" class="dbuttons buttonset">'
					+ '<label for="d0">Backup the configuration</label>'
					+ '</td><td><fieldset>To File &nbsp&nbsp:&nbsp&nbsp<input type="input" id="store_config" value="" class="dlabels" style="width:200px;"></fieldset>'
					+ '</td></tr>'
					+ '<tr><td>'
					+ '<input type="submit" name="load_button" id="d1" value="load" class="dbuttons cc_button">'
					+ '<label for="d1">Load Configuration</label>'
					+ '<td><form action="">'
					+ str
					+ '</form>'
					+ '</td></tr>'
					;
			$(table).append(but);	
			// Handle the content of the Backup/Restore screen
			$( "#gui_backup" ).on("click", ".dbuttons" ,function(e) 
			{

				bak = this.value;
				message("Backup Restore function chosen "+ bak);
				
				switch ( bak ) {
					case "store":
						var config_file = $( "#store_config").val();
						if (config_file.substr(-4) != ".cfg") config_file += ".cfg" ;
						send_2_set("store_config",config_file);
						if (debug>0) myAlert("Backup: "+ config_file);
					break;
						
					case "load":
						var config_file = $( "#load_config").val();
						//alert("config_file: "+config_file);
						send_2_set("load_config",config_file);
						if (debug>0) myAlert("The configuration file is now set to: "+config_file,"CONFIGURATION");
					break;
					default:
						myAlert("Unknown option for Backup Setting: "+bak);
				}
			})
		break; //5
		
		default:
			myAlert("Config encountered internal error: unknown button");
		
	}
}

// --------------------------------- BUTTONS ----------------------------------------------
//
//		Print a room button to DOM
//		Please not that the id of the room buttons is only defined here
//		id = id of the button as defined in the JaSON structure 
//			The button is placed in a table element <td>
//		val: The value or 'label' on the button
//		hover: If specified, contains css class (String) to add to the button
//
function room_button(id, val, hover) 
{
			var but = ''
//			+ '<td>'
			+ '<input type="submit" id="' + id + '" value= "'+ val + '" class="hr_button ' + hover + '">'
//			+ '</td>'
			return (  but );
}

//
// Scene button: Print the buttons in the header page. The contents of the scene
// is handled by the activity_button function.
//
function scene_button(id, val, hover) 
{
			var but = ''
			+ '<input type="submit" id="' + id + '" value= "'+ val + '" class="hs_button ' + hover + '">'
			return (  but );	
}

//
//
//
function menu_button(id, val, hover) 
{
			var but = ''
			+ '<td>'
			+ '<input type="submit" id="' + id + '" value= "'+ val + '" class="hm_button ' + hover + '">'
			+ '</td>'
			return (  but );	
}

//
// Print a timer button
//
//
function timer_button(id, val, hover) 
{
			var but = ''
			+ '<input type="submit" id="' + id + '" value= "'+ val + '" class="ht_button ' + hover + '">'
			return (  but );	
}
//
// Print a handset button
//
//
function handset_button(id, val, hover) 
{
			var but = ''
			+ '<input type="submit" id="' + id + '" value= "'+ val + '" class="hh_button ' + hover + '">'
			return (  but );	
}
//
// Re use of button class
//
//
function setting_button(id, val, hover) 
{
			var but = ''
			+ '<input type="submit" id="' + id + '" value= "'+ val + '" class="hc_button ' + hover + '">'
			return (  but );	
}

// ------------------------------------- DEVICES -----------------------------------------

// STORE_DEVICE
// Store the value of the device_id in the GUI back in the devices object 
// Local on the client. The daemon will as of release 1.4 take care of syncing the value
// to the dtabase (should that be necessary based on persist)
//
// Inputs:
//	room: The room id of the object in the devices array (is a number)
//	dev_id: The device id in the object devices. This is a 2-character index
//	val: The value to store. This is a number for sliders and "ON" "OFF" for buttons
//
// This way, when changing rooms it is possible to "remember" slider and buttons settings
// between sessions
//
function store_device(room, dev_id, val) 
{
	for (var j = 0; j<devices.length; j++ )
	{
  		var device_id = devices[j]['id'];
		var room_id = devices[j]['room'];
			
       	if (( room_id == room ) && ( device_id == dev_id ))
		{
//			var device_name = devices[j]['name'];
			var device_type = devices[j]['type'];
			// add value to the devices object
			
			// This would then not be a switch in OFF
			if (( val == 'OFF' ) && (device_type == "switch")) { 
				devices[j]['val'] = 0; 
				}
			else if (( val == 'ON' ) && (device_type == "switch")) { 
				devices[j]['val'] = 1; 
				}
			else if (( val == 'ON' ) && (device_type == "dimmer")) { 
				devices[j]['val'] = devices[j]['lastval'] ; 
			}
			else if (( val == 'OFF') && (device_type == "dimmer")) {
				devices[j]['val'] = 0 ; 
			}													   			
			else { 
				devices[j]['val'] = val ;  
				devices[j]['lastval'] = val;
			}

			// If we are here, there is a match with room_ and dev_id found
			// in the database, and the client-side has been updated.
			
			// XXX We can now also update the server side!
			// Just to test the function!!
			// send_2_dbase can handle several "command", "message" combinations
			// Only store if the persist mode is NOT easy == 0
			
			//if (persist > 0)
			//	send_2_dbase("store_device", devices[j]);
			
			return(1)								// Stop loop
		}
	}
	return(1);	
}

//
// Find the device in the devices array and return the array index
//
function find_device(rm_id, dev_id)
{
	for (var j = 0; j<devices.length; j++ )
	{
  		var device_id = devices[j]['id'];
		var room_id = devices[j]['room'];
			
       	if (( room_id == rm_id ) && ( device_id == dev_id ))
		{
			return( j );
		}
	}
	return(-1);		
}


//
// Load the value of a device from the gui variable
// Inputs:
//			rm_id: The index for the room to load (probably the active room)
//			dev_id: The index of the device in the object array
// XXX we need to change the load/store functions so that they store
// complete object of one device: array of values for that rm_id and that dev_id
//
function load_device(rm_id, dev_id)
{
	for (var j = 0; j<devices.length; j++ )
	{
  		var device_id = devices[j]['id'];
		var room_id   = devices[j]['room'];	
       	if (( room_id == rm_id ) && ( device_id == dev_id ))
		{
			// we might use the 2 values below to change the name of the device as well
//			var device_name = devices[j]['name'];
//			var device_type = devices[j]['type'];
			// add value to the devices object
			var val = devices[j]['val'];
			// Stop loop
			return( val );
		}
	}
	return(1);		
}

// ---------------------------------- GET SCENE ------------------------------------

// This function takes the id of a scene ( index 0-31 in the array, id 1-32 in the database )
// and returns the corresponding scene in the database
// We could (sometimes) have worked with the index -1, but this would then not allow
// us to shuffle sequences (where at a moment the scene with id 6 might be located in scenes[2])
//
function get_scene(scn_id)
{
	for (var j = 0; j<scenes.length; j++ )
	{
       	if ( scenes[j]['id'] == scn_id )
		{
			return( scenes[j] );
		}
	}
	return(1);		
}


// Same function but now for handset
//
function get_handset(hs_id)
{
	for (var j = 0; j<handsets.length; j++ )
	{
       	if ( handsets[j]['id'] == hs_id )
		{
			return( handsets[j] );
		}
	}
	return(1);		
}

function get_handset_record(hs_id,hs_unit,hs_val)
{
	for (var j = 0; j<handsets.length; j++ )
	{
       	if ((handsets[j]['id'] == hs_id) && (handsets[j]['unit'] == hs_unit) && (handsets[j]['val'] == hs_val))
		{
			return( handsets[j] );
		}
	}
	return(1);		
}

// ---------------------------------- GET TIMER ------------------------------------

// This function takes the id of a scene ( index 0-31 in the array, id 1-32 in the database )
// and returns the corresponding scene in the database
// We could (sometimes) have worked with the index -1, but this would then not allow
// us to shuffle sequences (where at a moment the scene with id 6 might be located in scenes[2])
//
function get_timer(tim_id)
{
	for (var j = 0; j<timers.length; j++ )
	{
       	if ( timers[j]['id'] == tim_id )
		{
			// return value of the object
			return( timers[j] );
		}
	}
	return(-1);		
}

function set_timer(tim_id,timer)
{
	for (var j = 0; j<timers.length; j++ )
	{
       	if ( timers[j]['id'] == tim_id )
		{
			// add value to the  object
			timers[j]=timer;
			return(0);
		}
	}
	return(-1);		
}

// ---------------------------------------------------------------------------------------------------------------------
//	Handle incoming device requests, translate to a standard message and send to device by AJAX
//
//	Input: The id of the calling button (!). Which will for ICS in general be the same id as the real device name
//			in the ICS appliance. 
// 			The Value of the button pressed
//
//	Maybe we do not really need this function, but it's there to make translations
//	between the gui id's and the real device id's simpler, and allows commands for
//	other devices than just the ICS-1000 (we need to add a devicetype parameter)
//
// XXX We will standardize in the client application on the messaging format that is used by KlikAanKlikUit.
// However, onze received by the backend these messages may either be forwarded to the ICS or
// translated to another controller so that it operates independent from the 
// device controller used. 

// The choice for the ICS-1000 initially is OK, but we should expect other
// controllers as well, and for that matter other destinations to send the message to might pop-up...
//
function handle_device(id,val) 
{
		// We know the current room s_room_id
		// and the current device_id is passed by the handler to this function
		// NOTE: This function now ONLY works correct for the ICS-1000 device. If we like
		// to work with other technologies such as Zwave we need a translation between buttons and device codes
		// specific for such a device.

		var str = "!R" + s_room_id + id;	// str bcomes something like: !R1D2"
											// val is like "F1" "ON" "OFF"
		
		if ( debug>2 ) 
			alert ("handle_device:: \nstr: " + str + "\nval: " + val );
		
		switch (val) {
			

			case "Fo":
				str = str + "Fo";
			break;
			
			// For type dimmer/slider we  have set the behaviour so that
			// pressing the ON button twice will not start dimming up/down, but
			// only restore to last light setting
			case "ON":
			case "F1":
				//console.log("handle_device:: F1 recognized");
				
				for (var i=0; i< devices.length; i++) {
					if(( devices[i]['id'] == id) && (devices[i]['room'] == s_room_id)){
						if (devices[i]['type'] == "dimmer") {
							//alert ("handle_device:: dimmer translate");
							// translate F1 into 
							str = str + "FdP" + devices[i]['lastval'];
							// update of value done by database handler
							break;
						}
						else {
							str = str + "F1";
							break;
						}
					}
				}
			break;
			
			case "OFF":
			case "F0":
				str = str + "F0";
			break;
			
			case "DUP":
				str = str + "S1";
			break;
			
			case "D":
				alert("handle_device:: " + val + " command not recognized");
			break;
			
			default:
				// must be dimmer, val is P0 through P32
				// Need to have better pasing of the arguments
				str = str + val;
		}	
		// str is now complete. Next we need to find out where to send the command string to.
		var brand = "";
		for (var i=0; i< devices.length; i++) {
			if (( devices[i]['id'] == id.substr(0,2) ) && ( devices[i]['room'] == s_room_id )) {
				
				var brand_id = devices[i]['brand'];
				brand = brands[brand_id]['fname'];
				break;
			}
		}
		console.log("handle_device:: lamp code is: "+str);
		//alert("handle_device:: brand: "+brand+", str:"+str);
		message_device(brand,str);	
}


// ---------------------------------------------------------------------------------------
// Decode a timers scene 'seq' command string in ICS format back to human readable form so that we can build 
// a scene listing 
//
//
function decode_scene_string (str)
{
	if (debug > 1)
	{ console.log("decode_scene_string: " + str);
	}
	var pos1, room, dev, cmd, res;
	pos1 = 0;
	switch (str.substr(pos1,1))
	{
	// Device command
	case '!':
		pos1++;
		// room
		res = '';
		if ( str.substr(pos1,1) == 'R' ) { 
			pos1++;
			var nxt = str.substr(pos1+1,1);
			// If room number is only one position, as char+1 is alread a D or F
			if  (( nxt == "D" ) || ( nxt == "F" )) {
				room = str.substr(pos1,1); 
				pos1++; 
			}
			else { 
			// Room number is 2 positions
				room = str.substr(pos1,2); 
				pos1+=2; 
			}
		} // if 'R'
		else { 
			alert("decode_scene: Room not found in command string"); 
		};

		// Lookup the room in the memory database
		for (var i=0; i < rooms.length; i++ ) {
			if ( rooms[i]['id'] == room ) { res += rooms[i]['name'] }; 
		}
		// Char at current position
		// if command is D we have a device command
		// The D1 -- D32 device ident is OPTIONAL in the syntax.
		if ( str.substr(pos1,1) == 'D' ) { 
			res += ', ';
			pos1++;
			if (str.substr(pos1+1,1) == 'F' ) { 
				dev = str.substr(pos1,1); 
				pos1++; }
			else { 
				// Shift one position for rooms 10-31
				dev = str.substr(pos1,2); 
				pos1+=2; }
		
			for (var i=0; i < devices.length; i++ ) {
				if ((devices[i]['id'] == 'D'+dev ) && (devices[i]['room'] == room )) { 
					res += devices[i]['name'] 
					switch (devices[i]['type'])
					{
					case "dimmer": 
						res += ', dimmer' ;
					break;
					
					case "switch":
						res += ', switch' ;
					break;
					
					// Sunblinds and energy not implemented 
					default:
						alert("decode_scene:: Unsupported devicetype: " + devices[i]['type']);
					}
				} 
			} 
			// Is this an all off or all on command, F code?
			if ( str.substr(pos1,1) == 'F' ) {
				pos1++;
				cmd = str.substr(pos1,1);
				switch (cmd) {
					case 'a':
						res += ', ALL OFF';
					break;
					case 'o':
						res += ', set dimmer';
					break;
					case '0':
						res += ', OFF';
					break;
					case '1':
						res += ', ON';
					break;
					case 'k':
						res += ', Man. Lock';
					break;
					case 'l':
						res += ', Full Lock';
					break;
					case 'd':
						pos1++;
						if (str.substr(pos1,1) == 'P') {
							pos1++;
							res += ', dim value: ' + str.substr(pos1);
						}
					break;
				}
			}
		}
		// nxt must be a F command for all off or Moods setting
		else if ( str.substr(pos1,1) == "F" ) {
			res += ', All off' ;
		}
		else { // XXX
			alert("Unknown syntax: " + nxt + " at this position. cmd:: "+str);
		}	
	break;
	
	// Timing delay
	case '0':
		res = 'Timing delay ' + str.substr(1) ;
	}
	return (res);
}



// ---------------------------------------------------------------------------------------
//	Function database inits all communication with the database backend
//
//  This is the only AJAX function in the file that is sort of synchronous.
//	This because we need the values before we can setup rooms, devices, debug etc settings
//
function load_database(dbase_cmd) 
{
	var sqlServer = murl + 'backend_sql.php';
	if (debug>1) alert("load_database:: sqlServer:: " + sqlServer);
		$.ajax({
        	url: sqlServer,	
			async: false,					// Synchronous operation 
			type: "POST",								
         	dataType: 'json',
			data: {
					action: "load_database",
					message: dbase_cmd
				},
			timeout: 6000,
         	success: function( data )
				{
					// XXX Future improvement: Only get one room or scene at a time, not the whole array !!
					//
					rooms = data.appmsg['rooms'];			// Array of rooms
					devices = data.appmsg['devices'];		// Array of devices			
					// XXX These 5 should be retrieved upon activation, but this finetuning not done yet!
					scenes = data.appmsg['scenes'];
					timers = data.appmsg['timers'];
					handsets = data.appmsg['handsets'];
					settings = data.appmsg['settings'];
					brands = data.appmsg['brands'];
					
					// For all rooms write a button to the document
					$("#gui_header").append('<table border="0">');	// Write table def to DOM
					var table = $( "#gui_header" ).children();		// to add to the table tree in DOM
					
					// INIT IS THE ONLY FUNCTION DONE AFTER LOADING THE DATABASE
					// FIRST TIME. AND BY PUTTING IN SUCCESS WE MAKE IT SYNCHRONOUS!
					init();
					// XXX If we run load_dbase sync, then we can
					// call init separately in the ready() function which is cleaner
					
					// Send debug message is desired
					if (debug > 1) {							// Show result with alert		
          				alert('Ajax call init_dbase success. '
						+ '\nTransaction Nr: ' + data.tcnt
				  		+ ',\nStatus: ' + data.status 
						+ '.\nApp Msg: ' + data.appmsg 
						+ '.\nApp Err: ' + data.apperr 
						);
					}
					// Function finished successfully
					but = 'Init function success' ;
					if (debug > 1) {
						but += "<br>AppErr: " + data.apperr;
					}
					message(but);
					return(0);

         		}, 
			error: function(jqXHR, textStatus, errorThrown)
			{
          			// data.responseText is what you want to display, that's your error.
          			alert("load_database:: for " + sqlServer 
						  + " sending cmd:: " + dbase_cmd
						  + "\nError: " + jqXHR
						  + "\nTextStatus: "+ textStatus
						  + "\nerrorThrown: "+ errorThrown 
						  + "\n\nFunction will finish now!" );
					return(-1);
         	}
		});
			
}



// -----------------------------------------------------------------------------------	
//	This is a universal piece of code for sending commands to lamp devices
//  The function only knows about lamp id's. Commands for switching on/off
//  are based on those buttons
//
//	The backend function will take care of the command interpretation, at this
// moment the iCS command structure serves as a universal piece of code
//
// input : STRING action setting "device", "scene", "timer" makes easier for backend
// input : STRING controller_cmd (only ics) in the form of "!R1D2F1"
//
function message_device(action, controller_cmd) 
{
	// We could also put this part at the end of the function. Then the command
	// would be executed, now we exit without sending the command
	if ( s_recording ) {
		s_recorder += controller_cmd;
		activate_scene(s_scene_id);
		return(1);
	}
	if (( phonegap == 1 ) || (settings[1]['val'] == 0 ))
	{
		$.ajax({
        	url: s_controller,
			type: "POST",
         	dataType: 'json',
			data: {
				action: action,
				message: controller_cmd
			},
			timeout: 5000,										// 8 Seconds
         	success: function( data ){
				switch (data.status) {
					case "OK":
						var but = '' 
						+ 'Dev cmd '+ controller_cmd 
						+' <br>Status: ' + data.status 
						+', Return: ' + data.appmsg
						;
						if (debug > 0) {
							but += "\nAppErr: " + data.apperr;
						}
						message(but);
					break;
					case "ERR":
						var but = ''  
						+ 'Dev cmd:'+ action +','+ controller_cmd 
						+' <br>Status: ' + data.status 
						+' Error: ' + data.apperr
						;
						message(but);
					break;
				}

          		if (debug>1) {

          			myAlert('message_device: ' + action
						  + '\ntransaction:' + data.tcnt
						  + '\nStatus: '    + data.status
						  + '\n\nApp Msg: ' + data.appmsg
						  + '\n\nApp Err: ' + data.apperr);
				}
         	}, 
			error: function(jqXHR, textStatus, errorThrown){
          		// data.responseText is what you want to display, that's your error.
          		myAlert("Message_device Error on " + action 
					  + "\ncontroller_cmd: " + controller_cmd 
					  + "\njqXHR: " + jqXHR 
					  + "\ntextstatus" + textStatus + ", " + errorThrown);
         	}
		}); // ajax
	} // if ics
	
	// Else, if not using phonegap, and controller == raspberry, use websockets 
	else if (( phonegap != 1 ) && (settings[1]['val'] == 1 ))
	{
		console.log("websockets:: sending "+controller_cmd);
		var data = {
			tcnt: ++w_tcnt%1000,
			action: "kaku",	
			message: controller_cmd
		};
		
		for (var i=0; i<4; i++) {				// This could be forever, have to build a limit ...
			switch (w_sock.readyState) {
			// 0: Not yet ready
			case 0:
				console.log("Websocket:: readystate not ready: "+w_sock.readyState);
			break;
			// 1: ready
			case 1: 
				w_sock.send(JSON.stringify(data));
				return(0);
			break;
			// 2: close in progress
			case 2:
			
			break;
			// 3: closed
			case 3:
				console.log("Websocket:: readystate closed: "+w_sock.readyState);
				w_sock = WebSocket(w_uri);
				console.log("Websocket:: socket re-opened: "+w_sock.readyState);
			break;
		
			default:
				console.log("Websocket:: readystate not defined: "+w_sock.readyState);
			}
		}
		console.log("Websocket:: unable to transmit message 3 times: "+w_sock.readyState);
	}//else
	else {
		message("message_device:: xmit faked");
	}
}



// -------------------------------------------------------------------------------------------
// Sync the MySQL or file database on the backend
// This function gets called by a button on the GUI Parameter for the Ajax peer; "store_xxx" command
//		followed by the records in rooms, devices and scenes
//
//	We want to store the data to the other side and there they need to sort whether that is in files or SQL
//
function send_2_dbase(dbase_cmd, dbase_arg) 
{
	$.ajax({
   		url: murl + 'backend_sql.php',				   
		type: "POST",
    	dataType: 'json',								// TO receive json ...
		//contentType: 'application/json; charset=UTF-8',				// MMM To SEND(!) json???
		data: {
			action: dbase_cmd,
			message: dbase_arg							// Can be several command types !!
		},
		timeout: 8000,
    	success: function( data )
		{
			// Make room 1 default
			if ( debug > 0 ) message("Send 2 dbase:: Success");	
					
			// Send debug message if desired
			if (debug > 1) {							// Show result with alert		
          			alert('Ajax call send_2_dbase: ' + dbase_cmd + ' success: \n' 
				  	+ ',\nStatus: ' + data.status 
					+ '.\nApp Msg: ' + data.appmsg 
					+ '.\nApp Err: ' + data.apperr 
					);
			}
			message (data.appmsg);						// Function finished successfully
		},
		error: function(jqXHR, textStatus, errorThrown)
		{
			// data.responseText is what you want to display, that's your error.
			alert("send_2_dbase:: "
			+ "\nError: " + jqXHR
			+ "\nTextStatus: "+ textStatus
			+ "\nerrorThrown: "+ errorThrown
			+ "\n\nFunction will finish now!" );
			return(-1);
		}
	});
};



// --------------------------------------------------------------------------------------
// Send_2_set: Send commands to the backend PHP system. 
// These commands are used for retrieving skins, setting and other stuff
// supporting the GUI program.
// As we need the results of this call for our program, we need SYNC call, so
// we can wait for the results in our program.
//
// NOTE: We call init functions SYNCHRONOUS, as it modifies the app under our hands
// This may be the only function therefore that we keep separate from the daemon.
//
function send_2_set(command, parameter) 
{
	var result = {};
	$.ajax({
		async: false,								// Synchronous operation
   		url: murl + "backend_set.php",				   
		type: "POST",
    	dataType: 'json',
		//contentType: 'application/json',
		data: {
			action: command,
			message: parameter						// Can be several command types !!
		},
		timeout: 7000,
    	success: function( data )
		{
			// Make room 1 default
			if (debug>0) message("send_2_set:: Success");	
					
			// Send debug message if desired
			if (debug>1) {							// Show result with alert		
          		alert('Ajax call send_2_set success: \n' 
					+ ',\nStatus: ' + data.status 
					+ '.\nApp Msg: ' + data.appmsg 
					+ '.\nApp Err: ' + data.apperr 
				);
			}
			result = data.appmsg;
			return(result);
			// Function finished successfully
		}, 
		error: function(jqXHR, textStatus, errorThrown)
		{
			// data.responseText is what you want to display, that's your error.
			alert("send_2_set:: command: " + command 
				+ "\nError:" + jqXHR
				+ "\nTextStatus: "+ textStatus
				+ "\nerrorThrown: "+ errorThrown 
				+ "\n\nFunction will finish now!" );
			return(-1);
		}
	});	
	if (debug>2) alert("send_2_set:: returning"+ result);
	return (result);
};
