"use strict";

import fs = require("fs");
import path = require("path");
import http = require("http");
import subprocess = require("child_process");
//import zlib = require("zlib");
//import AdmZip = require("adm-zip");

/* Test whether a file exists, returning true or false 
 */
function testPathExistsSync(path: string) {
    try {
        let stats = fs.lstatSync(path);
        return true;
    }
    catch (error) {
        console.log(error);
        return false;
    }
}

/* This interface is just like the built in JS objects which have 'string' keys and 'any' values */
interface IStringToAnyMapping<Type> {
    [key: string]: Type;
}

/* Bare wrapper around JS objects that let me include some really basic features that should already exist, ugh */
class Dictionary<ValueType> {
    public map: IStringToAnyMapping<ValueType> = {};
    get keys() {
        var _keys = [];
        for (let key in this.map) {
            if (this.map.hasOwnProperty(key)) { 
                _keys.push(key);
            }
        }
        return _keys;
    }
    get values() {
        var _values = [];
        for (let key in this.map) { 
            if (this.map.hasOwnProperty(key)) {
                _values.push(this.map[key]);
            }
        }
        return _values;
    }
    get length() { 
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
}
class DialogLine implements IDialogLine{
	constructor(public character: Character, public movie: Movie, public text: string, public cornellId: number) {}
}

interface IConversation {
	characters: Character[];
	movie: Movie;
	lines: DialogLine[];
}
class Conversation implements IConversation {
	constructor(public characters: Character[], public movie: Movie, public lines: DialogLine[]) {}
}

interface ICorpus {
	movies:         Dictionary<Movie>;
	characters:     Dictionary<Character>;
	lines:          Dictionary<DialogLine>;
	conversations:  Conversation[];
}
class Corpus implements ICorpus {

    // TODO: this is dumb bad design lol. REVISITREVISITREVISITREVISITREVISIT
	corpusZipUrl      = "http://www.mpi-sws.org/~cristian/data/cornell_movie_dialogs_corpus.zip";
	static spamplayCacheDir  = path.join(__dirname, "cache");
	static corpusCachedZip   = path.join(Corpus.spamplayCacheDir, "cornell_movie_dialogs_corpus.zip");
    static corpusCacheDir    = path.join(Corpus.spamplayCacheDir, "cornell movie-dialogs corpus");
	static charactersFile    = path.join(Corpus.corpusCacheDir, 'movie_characters_metadata.txt');
	static conversationsFile = path.join(Corpus.corpusCacheDir, 'movie_conversations.txt');
	static linesFile         = path.join(Corpus.corpusCacheDir, 'movie_lines.txt');
	static moviesFile        = path.join(Corpus.corpusCacheDir, 'movie_titles_metadata.txt');
    
    parsedMovies = false;
    parsedCharacters = false;
    parsedLines = false;
    parsedConversations = false;

    // TODO: lol I can't figure out computed properties, fucking figure it out and do that instead. 
    parsingComplete() { 
        return this.parsedMovies && this.parsedCharacters && this.parsedLines && this.parsedConversations
    }

    constructor(
        public movies:         Dictionary<Movie>       = new Dictionary<Movie>(),
        public characters:     Dictionary<Character>   = new Dictionary<Character>(),
        public lines:          Dictionary<DialogLine>  = new Dictionary<DialogLine>(),
        public conversations:  Conversation[]          = new Array<Conversation>())
    {}

	static fromZip() {
        var newCorpus = new Corpus();
        
        try { fs.mkdirSync(Corpus.spamplayCacheDir); } catch (error) {}; // TODO: throw any error except one where the dir alredy exists
        if (! (testPathExistsSync(Corpus.spamplayCacheDir)) ) {
            throw "You didn't get the Corpus and I'm too dumb to do it for you yet";
        }
        if (!testPathExistsSync(Corpus.corpusCacheDir)) {
            newCorpus.unzipCorpusWithShellOut();
        }

        // TODO: use some async library (ugh) to parallelize these: 
        newCorpus.parseRawMoviesString( fs.readFileSync(Corpus.moviesFile).toString() );
        newCorpus.parseRawCharactersString( fs.readFileSync(Corpus.charactersFile).toString() );
        newCorpus.parseRawLinesString( fs.readFileSync(Corpus.linesFile).toString() );
        newCorpus.parseRawConversationsString( fs.readFileSync(Corpus.conversationsFile).toString() );

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

    unzipCorpusWithShellOut() {
        let output = subprocess.execSync(`unzip -d "${Corpus.spamplayCacheDir}" "${Corpus.corpusCachedZip}"`);
    }

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
            var movieId = parseInt(splitLine[0].substring(1));
            var title = splitLine[1];
            var year = parseInt(splitLine[2]);
            var rating = parseFloat(splitLine[3]);
            var voteCount = parseInt(splitLine[4]);
            //var genres = splitLine[5]; // TODO: split this into something useful
            this.movies.map[movieId.toString()] = new Movie(title, year, rating, voteCount, movieId);
        }
        let completionClosure = () => { 
            console.log(`Parsed ${this.movies.length} movies`);
            this.parsedMovies = true; 
        };
        this.parseRawCorpusString(movies, 6, lineParser, completionClosure);
    }
    parseRawCharactersString(characters: string): void {
        let lineParser = (splitLine: string) => {
            var charId = parseInt(splitLine[0].substring(1));
            var charName = splitLine[1];
            var movieId = parseInt(splitLine[2].substring(1));
            var movieName = splitLine[3];
            var movie = this.movies.map[movieId.toString()];
            var charGender = (splitLine[4] != '?') ? splitLine[4] : null;
            var creditsPosition = parseInt(splitLine[5]);
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
            var lineId = parseInt(splitLine[0].substring(1));
            var charId = parseInt(splitLine[1].substring(1));
            var character = this.characters.map[charId.toString()];
            var movieId = parseInt(splitLine[2].substring(1));
            var movie = this.movies.map[movieId.toString()];
            var charName = splitLine[3];
            var text = splitLine[4];
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
            var char1Id = parseInt(splitLine[0].substring(1));
            var char2Id = parseInt(splitLine[1].substring(1));
            let characters = [this.characters.map[char1Id.toString()], this.characters.map[char2Id.toString()]]
            let movieId = parseInt(splitLine[2].substring(1));
            let movie = this.movies.map[movieId.toString()];
            let lineIdStrings = splitLine[3].match(/L\d+/g);
            if (!lineIdStrings) { 
                console.log(`couldn't figure out the line IDs for convo "${splitLine.join(' ')}"`)
            }
            var lineObjects = [];
            for (var idy=0; idy < lineIdStrings.length; ++idy) {
                let lineId = lineIdStrings[idy];
                let lineObj = this.lines.map[lineId];
                lineObjects.push(lineObj);
            }
            this.conversations.push(new Conversation(characters, movie, lineObjects));
        }
        let completionClosure = () => { 
            console.log(`Parsed ${this.conversations.length} conversations`)
            this.parsedConversations = true; 
        }
        this.parseRawCorpusString(conversations, 4, lineParser, completionClosure);
   }
}

console.log("Attempting to parse corpus data...");
let corpus = Corpus.fromZip();

