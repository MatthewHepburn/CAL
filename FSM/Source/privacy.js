// FSM Workbench - a graphical finite state machine editor and simulator
// Copyright (C) 2017  Matthew Hepburn

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

"use strict";

const Privacy = {
    addButtons(){
        Privacy.addShowDataButton();
        Privacy.addClearDataButton();
    },
    addShowDataButton(){
        const html = "Click <a href='#' id='show-data-here'>here</a> to show the data that is currently stored from this domain (which includes other websites on the homepages server).";
        const pElem = document.querySelector("#show-data");
        pElem.innerHTML = html;
        pElem.innerHTML += "<br><code id='data-area'></code>";
        pElem.style.display = "";
        document.querySelector("#show-data-here").addEventListener("click", Privacy.showData);
    },
    addClearDataButton(){
        const html = "Click <a href='#' id='clear-data-here'>here</a> to clear all data stored on this device by this domain (including data from other websites on the homepages server).";
        const pElem = document.querySelector("#clear-data");
        pElem.innerHTML = html;
        pElem.style.display = "";
        document.querySelector("#clear-data-here").addEventListener("click", Privacy.clearData);
    },
    clearData(event){
        if(event){
            event.preventDefault();
        }
        // Clear localStorage
        localStorage.clear();
        // Clear cookies (alas more complex than document.cookie = "";)
        document.cookie.split(";").forEach(function(c) { document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); });
        document.cookie = "=" + document.cookie + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
        Privacy.showData();
    },
    showData(event){
        if(event){
            event.preventDefault();
        }
        const container = document.querySelector("#data-area");
        if(localStorage && Object.keys(localStorage).length > 0){
            container.innerHTML = "<b>LocalStorage:</b><br>" + Privacy.getLocalStorageString();
        } else {
            container.innerHTML = "<b>LocalStorage:</b><br>No data is currently stored";
        }
        if(document.cookie && document.cookie.length > 0){
            container.innerHTML += "<br><b>Cookies:</b><br>" + document.cookie;
        } else {
            container.innerHTML += "<br><b>Cookies:</b><br>No data is currently stored";
        }

    },
    getLocalStorageString(){
        const keys = Object.keys(localStorage).sort();
        let str = "<table>";
        keys.forEach(function(key){
            str += `<tr><td> ${key}</td><td>${JSON.stringify(localStorage.getItem(key))}</td></tr>`;
        });
        str += "</table>";
        return str;

    },
    init(){
        Privacy.addButtons();
    }
};

Privacy.init();