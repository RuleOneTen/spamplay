"use strict";

import fs = require("fs");
import path = require("path");
import http = require("http");
import subprocess = require("child_process");
//import zlib = require("zlib");
//import AdmZip = require("adm-zip");

/* Test whether a file exists, returning true or false 
 */
function testPathExistsSync(path: string): Boolean {
    try {
        let stats = fs.lstatSync(path);
        return true;
    }
    catch (error) {
        console.log(error);
        return false;
    }
}

/* Returns a random integer between min (included) and max (included)
 * Using Math.round() will give you a non-uniform distribution!
 * from: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
 */
function getRandomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function toTitleCase(str: string) {
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

/* Unzip a zipfile to a directory
 */
function unzipShellout(zipFile: string, outputDir: string) {
     let output = subprocess.execSync(`unzip -d "${outputDir}" "${zipFile}"`);
     console.log(output);
}

/* This interface is just like the built in JS objects which have 'string' keys and 'any' values */
interface IStringToAnyMapping<Type> {
    [key: string]: Type;
}

/* Bare wrapper around JS objects that let me include some really basic features that should already exist, ugh */
class Dictionary<ValueType> {
    public map: IStringToAnyMapping<ValueType> = {};
    get keys(): string[] {
        var _keys = [];
        for (let key in this.map) {
            if (this.map.hasOwnProperty(key)) { 
                _keys.push(key);
            }
        }
        return _keys;
    }
    get values(): ValueType[] {
        var _values = [];
        for (let key in this.map) { 
            if (this.map.hasOwnProperty(key)) {
                _values.push(this.map[key]);
            }
        }
        return _values;
    }
    get length(): number { 
        return this.values.length
    }
}

interface IMovie {
	title: string;
	year: number;
	imdbRating: number;
	imdbVoteCount: number;
	cornellId: number;
	genres: string[];	
}
class Movie implements IMovie {
	constructor(public title: string, public year: number, public imdbRating: number, public imdbVoteCount: number, public cornellId: number, public genres?: string[]) {}
}

interface ICharacter {
	name: string;
	movie: Movie; 
	cornellId: number;
	gender: string;
	creditPosition: number;
}
class Character implements ICharacter {
	constructor(public name: string, public movie: Movie, public cornellId: number, public gender: string, public creditPosition?: number) {}
}

interface IDialogLine {
	character: Character;
	movie: Movie;
	text: string;
	cornellId: number;
    print(): void;
}
class DialogLine implements IDialogLine{
	constructor(public character: Character, public movie: Movie, public text: string, public cornellId: number) {}
    consolePrint() {
        console.log(`<DialogLine #${this.cornellId.toString()} "${this.text}" - ${this.character.name} in _${this.movie.title}_`);
    }
    print() { 
        console.log(`${this.character.name}: "${this.text}"`);
    }
}

interface IConversation {
	characters: Character[];
	movie: Movie;
	lines: DialogLine[];
}
class Conversation implements IConversation {
	constructor(public characters: Character[], public movie: Movie, public lines: DialogLine[]) {}
    consolePrint() { 
        console.log(`================`)
        console.log(`${this.movie.title.toUpperCase()} (${this.movie.genres.join(", ")})`);
        this.lines.forEach(
            function(line: DialogLine, index: number, array: DialogLine[]) {
                console.log(`\n${line.character.name.toUpperCase()}: ${line.text}`);
            }
        )
        console.log(`================`)
    }
}

interface ICorpus {
	movies:         Dictionary<Movie>;
	characters:     Dictionary<Character>;
	lines:          Dictionary<DialogLine>;
	conversations:  Conversation[];
}
class Corpus implements ICorpus {

	corpusZipUrl      = "http://www.mpi-sws.org/~cristian/data/cornell_movie_dialogs_corpus.zip";
	spamplayCacheDir  = path.join(__dirname, "cache");
    
    parsedMovies = false;
    parsedCharacters = false;
    parsedLines = false;
    parsedConversations = false;

    get parsingComplete(): Boolean {
        return this.parsedMovies && this.parsedCharacters && this.parsedLines && this.parsedConversations;
    }

    constructor(
        public movies:         Dictionary<Movie>       = new Dictionary<Movie>(),
        public characters:     Dictionary<Character>   = new Dictionary<Character>(),
        public lines:          Dictionary<DialogLine>  = new Dictionary<DialogLine>(),
        public conversations:  Conversation[]          = new Array<Conversation>())
    {}

	static fromZip(): Corpus {
        var newCorpus = new Corpus();
        
        let corpusCachedZip   = path.join(newCorpus.spamplayCacheDir, "cornell_movie_dialogs_corpus.zip");
        let corpusCacheDir    = path.join(newCorpus.spamplayCacheDir, "cornell movie-dialogs corpus");
        let charactersFile    = path.join(corpusCacheDir, 'movie_characters_metadata.txt');
        let conversationsFile = path.join(corpusCacheDir, 'movie_conversations.txt');
        let linesFile         = path.join(corpusCacheDir, 'movie_lines.txt');
        let moviesFile        = path.join(corpusCacheDir, 'movie_titles_metadata.txt');

        try { fs.mkdirSync(newCorpus.spamplayCacheDir); } catch (error) {}; // TODO: throw any error except one where the dir alredy exists
        if (! (testPathExistsSync(newCorpus.spamplayCacheDir)) ) {
            throw "You didn't get the Corpus and I'm too dumb to do it for you yet";
        }
        if (!testPathExistsSync(corpusCacheDir)) {
            unzipShellout(corpusCachedZip, corpusCacheDir);
        }

        // TODO: use some async library (ugh) to parallelize these: 
        newCorpus.parseRawMoviesString(        fs.readFileSync(moviesFile).toString()        );
        newCorpus.parseRawCharactersString(    fs.readFileSync(charactersFile).toString()    );
        newCorpus.parseRawLinesString(         fs.readFileSync(linesFile).toString()         );
        newCorpus.parseRawConversationsString( fs.readFileSync(conversationsFile).toString() );

        return newCorpus;
    }

    // unzipCorpusWithAdmZip() {
    //     // TODO: typescriptify this
    //     let zip = new AdmZip(Corpus.corpusCachedZip);
    //     let moviesString = zip.readAsText('cornell movie-dialogs corpus/movie_titles_metadata.txt');
    //     let charactersString = zip.readAsText('cornell movie-dialogs corpus/movie_characters_metadata.txt');
    //     let linesString = zip.readAsText('cornell movie-dialogs corpus/movie_lines.txt');
    //     let conversationsString = zip.readAsText('cornell movie-dialogs corpus/movie_conversations.txt');

    //     // TODO: use some async library (ugh) to parallelize these: 
    //     this.parseRawMoviesString(moviesString);
    //     this.parseRawCharactersString(charactersString);
    //     this.parseRawLinesString(linesString);
    //     this.parseRawConversationsString(conversationsString);
    // }

    // TODO: how do I declare the signature of the foreachLine and callback functions ?
    parseRawCorpusString(rawString: string, requiredFieldCount: number, foreachSplitLine: Function, callback: Function) {
		let fieldSeparator = ' +++$+++ ';
        let linesArray = rawString.split('\n');
        if (linesArray.length <= 100) { console.log("Something's wrong...")};
        for (var idx=0; idx < linesArray.length; ++idx) {
            let line = linesArray[idx]
            let splitLine = line.split(fieldSeparator);
            if (line.length < 1) { 
                // Sometimes there is a blank newline at the end
                continue;
            }
            else if (splitLine.length != requiredFieldCount) {
                var errorString  = `Found a splitLine of invalid length '${splitLine.length}'`;
                    errorString += `\nexpected ${requiredFieldCount}`;
                    errorString += `\non line ${line} of length ${line.length}`;
                console.log(errorString);
                continue; 
            }
            foreachSplitLine(splitLine);
        }
        callback();
    }
    
    parseRawMoviesString(movies: string): void {
        let lineParser = (splitLine: string) => {
            let movieId = parseInt(splitLine[0].substring(1));
            let title = toTitleCase(splitLine[1]);
            let year = parseInt(splitLine[2]);
            let rating = parseFloat(splitLine[3]);
            let voteCount = parseInt(splitLine[4]);
            let lineIdStrings = splitLine[3].match(/L\d+/g);
            let genres = splitLine[5].match(/[a-zA-Z0-9\-]+/g);
            this.movies.map[movieId.toString()] = new Movie(title, year, rating, voteCount, movieId, genres);
        }
        let completionClosure = () => { 
            console.log(`Parsed ${this.movies.length} movies`);
            this.parsedMovies = true; 
        };
        this.parseRawCorpusString(movies, 6, lineParser, completionClosure);
    }
    parseRawCharactersString(characters: string): void {
        let lineParser = (splitLine: string) => {
            let charId = parseInt(splitLine[0].substring(1));
            let charName = toTitleCase(splitLine[1]);
            let movieId = parseInt(splitLine[2].substring(1));
            let movieName = splitLine[3];
            let movie = this.movies.map[movieId.toString()];
            let charGender = (splitLine[4] != '?') ? splitLine[4] : null;
            let creditsPosition = parseInt(splitLine[5]);
            this.characters.map[charId.toString()] = new Character(charName, movie, movieId, charGender, creditsPosition);
        }
        let completionClosure = () => {
            console.log(`Parsed ${this.characters.length} characters`);
            this.parsedCharacters = true;
        }
        this.parseRawCorpusString(characters, 6, lineParser, completionClosure);
    }
    parseRawLinesString(lines: string): void {
        let lineParser = (splitLine: string[]) => {
            let lineId = parseInt(splitLine[0].substring(1));
            let charId = parseInt(splitLine[1].substring(1));
            let character = this.characters.map[charId.toString()];
            let movieId = parseInt(splitLine[2].substring(1));
            let movie = this.movies.map[movieId.toString()];
            let charName = splitLine[3];
            let text = splitLine[4];
            this.lines.map[lineId.toString()] = new DialogLine(character, movie, text, lineId);
        }
        let completionClosure = () => {
            console.log(`Parsed ${this.lines.length} lines`);
            this.parsedLines = true; 
        }
        this.parseRawCorpusString(lines, 5, lineParser, completionClosure);
    }
    parseRawConversationsString(conversations: string): void {
        let lineParser = (splitLine: string[]) => { 
            let char1Id = parseInt(splitLine[0].substring(1));
            let char2Id = parseInt(splitLine[1].substring(1));
            let characters = [this.characters.map[char1Id.toString()], this.characters.map[char2Id.toString()]]
            let movieId = parseInt(splitLine[2].substring(1));
            let movie = this.movies.map[movieId.toString()];
            let lineIdStrings = splitLine[3].match(/L\d+/g);
            if (!lineIdStrings) { 
                console.log(`couldn't figure out the line IDs for convo "${splitLine.join(' ')}"`)
            }
            var lineObjects = [];

            lineIdStrings.forEach(
                (lineIdString: string, index: number, array: string[]) => {
                    let lineId = lineIdString.substring(1);
                    let lineObj = this.lines.map[lineId];
                    lineObjects.push(lineObj);
                }
            )

            this.conversations.push(new Conversation(characters, movie, lineObjects));
        }
        let completionClosure = () => { 
            console.log(`Parsed ${this.conversations.length} conversations`)
            this.parsedConversations = true; 
        }
        this.parseRawCorpusString(conversations, 4, lineParser, completionClosure);
    }

    randomConversation(): Conversation {
        return this.conversations[ getRandomIntInclusive(0, this.conversations.length) ]
    }
}

console.log("Attempting to parse corpus data...");
let corpus = Corpus.fromZip();

let intervalId = setInterval(
    function() {
        if (corpus.parsingComplete) {
            console.log("PARSING COMPLETE");
            corpus.randomConversation().consolePrint();
            clearInterval(intervalId);
        }
    },
    2000
);

