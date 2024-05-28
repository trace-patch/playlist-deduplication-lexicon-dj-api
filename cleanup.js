#!/usr/bin/env node

"use strict";
const playlistTypeAttr = "2";

function updateStatus(message, statusname) {
  const element = document.getElementById("root");
  const newParagraph = document.createElement(statusname);
  newParagraph.appendChild(document.createTextNode(message));
  element.append(newParagraph);
}

function apiRequest(endpoint) {
  /* takes the endpoint and returns the json representation
   */
  const lexiconApi = "http://localhost:48624/v1/";
  if (typeof endpoint === "string") {
    return fetch(lexiconApi + endpoint).then((response) => {
      return response.json();
    });
  }
  fuckedUpSomewhere(new Error("FUCK"));
}

function getValidPlaylistIDs(plLib, plIDSet = new Set()) {
  for (let pl = 0; pl < plLib.length; pl++) {
    if (Object.hasOwn(plLib[pl], "playlists")) {
      getValidPlaylistIDs(plLib[pl].playlists, plIDSet);
    }
    if (plLib[pl].type === playlistTypeAttr) {
      plIDSet.add(plLib[pl].id);
    }
  }
  console.log("Found " + plIDSet.size + " Playlists");
  return plIDSet;
}

function getLengthMappedPlaylists(playlistSet) {
  const lengthMappedPlaylists = new Map();

  for (let validatedID of playlistSet) {
    apiRequest("playlist?id=" + validatedID).then((request) => {
      const requestPlLength = request.data.playlist.tracks.length;
      if (!lengthMappedPlaylists.has(requestPlLength)) {
        lengthMappedPlaylists.set(parseInt(requestPlLength), new Array());
      }
      lengthMappedPlaylists.get(requestPlLength).push(request.data);
    });
  }
  return lengthMappedPlaylists;
}

/**
 * takes an array of playlists that have the same length
 * @param {Array} sameLengthPlaylists
 * @returns {Array}
 */
function getDuplicatePlaylists(
  sameLengthPlaylists,
  duplicateIDs = new Array(),
) {
  if (!Array.isArray(sameLengthPlaylists))
    return new Error(
      "Invalid Datatype! This method requires an Array of Playlists",
    );
  if (sameLengthPlaylists.length === 0 || sameLengthPlaylists.length === 1)
    return;
  while (sameLengthPlaylists.length > 1) {
    for (let i = 0; i < sameLengthPlaylists.length - 1; i++) {
      const isEqual = compareTracklists(
        sameLengthPlaylists[i].playlist.tracks,
        sameLengthPlaylists[i + 1].playlist.tracks,
      );
      if (isEqual) {
        console.log(
          "ID: " +
            sameLengthPlaylists[i + 1].playlist.id +
            " is a Duplicate of ID: " +
            sameLengthPlaylists[i].playlist.id,
        );
        let newEntry = sameLengthPlaylists[i + 1].playlist.id;
        duplicateIDs.push(newEntry);
        sameLengthPlaylists = sameLengthPlaylists.splice(i + 1, 1);
      }
    }
    sameLengthPlaylists = sameLengthPlaylists.splice(0, 1);
  }
  return duplicateIDs;
}

/**
 * @param {Map} sortedPlaylistsMap
 * @returns {Array}
 */
function getAllDuplicates(sortedPlaylistsMap, allDuplicatedIDs = new Array()) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  sleep(5000).then(() => {
    for (let plArray of sortedPlaylistsMap) {
      let newDuplicates = getDuplicatePlaylists(plArray[1]);
      if (Array.isArray(newDuplicates) && newDuplicates.length > 0) {
        for (let entry of newDuplicates) {
          allDuplicatedIDs.push(entry);
        }
      }
    }
    console.log(allDuplicatedIDs);

    const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
    sleep2(100).then(
      fetch("http://localhost:48624/v1/playlists", {
        method: "DELETE",
        body: JSON.stringify({ ids: allDuplicatedIDs }), // body data type must match "Content-Type" header
      }).then((response) => {
        console.log(response);
        location.reload();
      }),
    );
    return allDuplicatedIDs;
  });
}
/**
 * compares two tracklists and returns true if they are the same
 * does not care about order of the tracks
 * @param {Array} plA
 * @param {Array} plB
 * @returns {boolean}
 */
function compareTracklists(plA, plB) {
  let setA = new Set(plA);
  let setB = new Set(plB);

  return setA.isSubsetOf(setB) && setB.isSubsetOf(setA);
}
// starting execution
const loadTime = new Date(Date.now());
updateStatus(
  "I am alive, you just suck time: " + loadTime.toISOString() + "<br>",
);
//querying Lexicondj for all playlists
const playlistLibrary = apiRequest("playlists");
//
const validPlaylistIDs = playlistLibrary.then(
  (resolvedRequest) => {
    let unwrappedPlaylistLibrary = structuredClone(
      resolvedRequest.data.playlists,
    );
    return getValidPlaylistIDs(unwrappedPlaylistLibrary);
  },
  () => {
    return new Error();
  },
);
const mappingDependencies = [playlistLibrary, validPlaylistIDs];

const mappedPlaylists = Promise.allSettled(mappingDependencies).then(
  (result) => {
    console.log("playlistLibrary: " + result[0].status);
    console.log("validPlaylistsIDs: " + result[1].status);
    return getLengthMappedPlaylists(result[1].value);
  },
  () => {
    return new Error();
  },
);

const duplicatedPlaylists = mappedPlaylists.then((result) => {
  return getAllDuplicates(result);
});

const deletePrerequisites = [mappedPlaylists, duplicatedPlaylists];

const IDsToDelete = Promise.allSettled(deletePrerequisites).then(
  (result) => {
    console.log(result);
  },
  () => {
    return new Error();
  },
);

/*
 * TODO: Levenshtein_distance for playlists and titles https://en.wikipedia.org/wiki/Levenshtein_distance
 */
