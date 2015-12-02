import fs = require("fs");
import path = require("path");
import http = require("http");
import zlib = require("zlib");

/* Test whether a file exists, returning true or false 
 */
function testPathExists(path: string) {
    try {
        let stats = fs.lstatSync(this.corpusCachedZip);
        return true;
    }
    catch (error) {
        return false;
    }
}

/* Coerce an array-like object - such as the automatic 'arguments' variable - to be an array
 * From: <http://hustoknow.blogspot.com/2010/10/arrayprototypeslicecallarguments.html>
 * See also: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments>
 */
function coerceArray(arrayLikeObject: any) {
    return Array.prototype.slice.call(arrayLikeObject);
}

/* From <http://book.mixu.net/node/ch7.html>
 * Run a series of asynchronous calls - each call will wait until the previous one finishes, but all will run off the main thread
 * parameter: tasks: an array of functions. 
 *   Each of these functions is expected to wrap an asynchronous function which takes a callback
 *   Each one should take its own callback argument, and provide it to the asynchronous function 
 * parameter: final: a function which takes one argument: an array of results from previous tasks. 
 */
function asyncSeries(tasks: Function[], final: Function) {
    var results = [];
    function next() {
        var thisTask = tasks.shift();
        if (thisTask) {
            thisTask(function() {
                results.push(coerceArray(arguments));
                next();
            });
        } 
        else {
            final(results);
        }
    }
    next();
}

/* From
 * Run a set of asynchronous calls, and when they're all finished, run a final call
 * parameter: tasks: an array of functions. Each function should take one argument, which itself is a function
 *   Each of these functions is expected to wrap an asynchronous function which takes a callback
 *   Each one should take its own callback argument, and provide it to the asynchronous function 
 * parameter: final: a function which takes one argument: an array of results from the previous tasks
 */
function asyncParallel(tasks: Function[], final: Function) {
    var results = [];
    var result_count = 0;
    tasks.forEach(function(callback, index) {
        callback( function() {
            results[index] = coerceArray(arguments);
            result_count++;
            if (result_count == tasks.length) {
                final(results);
            }
        });
    });
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
	public title: string;
	public year: number;
	public imdbRating: number;
	public imdbVoteCount: number;
	public cornellId: number;
	public genres: string[];
	
	constructor(title: string, year: number, imdbRating: number, imdbVoteCount: number, cornellId: number, genres?: string[]) { 
		this.title = title;
		this.year = year;
		this.imdbRating = imdbRating;
		this.imdbVoteCount = imdbVoteCount;
		this.cornellId = cornellId;
		this.genres = genres;
	}
}

interface ICharacter {
	name: string;
	movie: Movie; 
	cornellId: number;
	gender: string;
	creditPosition: number;
}
class Character implements ICharacter {
	public name: string;
	public movie: Movie; 
	public cornellId: number;
	public gender: string;
	public creditPosition: number;
	constructor(name: string, movie: Movie, cornellId: number, gender: string, creditPosition?: number) {
		this.name = name;
		this.movie = movie;
		this.cornellId = cornellId;
		this.gender = gender;
		this.creditPosition = creditPosition;
	}
}

interface IDialogLine {
	character: Character;
	movie: Movie;
	text: string;
	cornellId: number;
}
class DialogLine implements IDialogLine{
	public character: Character;
	public movie: Movie;
	public text: string;
	public cornellId: number;
	constructor(character: Character, movie: Movie, text: string, cornellId: number) {
		this.character = character;
		this.movie = movie;
		this.text = text;
		this.cornellId = cornellId;
	}
}

interface IConversation {
	characters: Character[];
	movie: Movie;
	lines: DialogLine[];
}
class Conversation implements IConversation {
	public characters: Character[];
	public movie: Movie;
	public lines: DialogLine[];
	constructor(characters: Character[], movie: Movie, lines: DialogLine[]) {
		this.characters = characters;
		this.movie = movie;
		this.lines = lines;
	}
}

/* TODO: I can't seem to type these correctly?
interface ICorpus {
	movies:         {number: Movie};
	movieIds:       number[];
	characters:     {number: Character};
	characterIds:   number[];
	lines:          {number: DialogLine};
	lineIds:        number[];
	conversations:  Conversation[];
}
*/
interface ICorpus {
	movies:         {};
	movieIds:       number[];
	characters:     {};
	characterIds:   number[];
	lines:          {};
	lineIds:        number[];
	conversations:  Conversation[];
}
enum CorpusState {
    Initial, 
    Downloaded,
    Parsed
}
class Corpus implements ICorpus {
	public movies:         {};
	public movieIds:       number[];
	public characters:     {};
	public characterIds:   number[];
	public lines:          {};
	public lineIds:        number[];
	public conversations:  Conversation[];
	
	corpusZipUrl      = "http://www.mpi-sws.org/~cristian/data/cornell_movie_dialogs_corpus.zip";
	corpusCacheDir    = path.join(__dirname, "corpusCache");
	corpusCachedZip   = path.join(this.corpusCacheDir, "cornell_movie_dialogs_corpus.zip");
	charactersFile    = path.join(this.corpusCacheDir, 'movie_characters_metadata.txt');
	conversationsFile = path.join(this.corpusCacheDir, 'movie_conversations.txt');
	linesFile         = path.join(this.corpusCacheDir, 'movie_lines.txt');
	moviesFile        = path.join(this.corpusCacheDir, 'movie_titles_metadata.txt');
    
    parsedMovies = false;
    parsedCharacters = false;
    parsedLines = false;
    parsedConversations = false;
			
	constructor() {
		this.movies = this.characters = this.lines = {};
		this.conversations = [];
		this.movieIds = this.characterIds = this.lineIds = [];
		
        // Download and extract the corpus: 
        let tasks = [
            function(callback) { fs.mkdir(this.corpusCacheDir, callback)},
            function(callback) { 
                if (testPathExists(this.corpusCachedZip)) {
                    callback();
                }
                else {
                    let fileWriter = fs.createWriteStream(this.corpusCachedZip);
                    let request = http.get(this.corpusZipUrl, function(response){
                        response.pipe(fileWriter);
                        //this.state = CorpusState.Downloaded;
                        callback();
                    });
                }
            },
            function(callback) { throw "Extract the individual files here"; callback(); },
            function(callback) { this.parseRawMoviesString(this.moviesString); callback(); },
            function(callback) { this.parseRawCharactersStrinh(this.charactersString); callback(); },
            function(callback) { this.parseRawLinesString(this.linesString); callback(); },
            function(callback) { this.parseRawConversationsString(this.conversationsString); callback(); }
        ]
        asyncSeries(tasks, null);
	}
	
    //state: CorpusState = CorpusState.Initial;
	

    // TODO: how do I declare the signature of the foreachLine and callback functions ?
    parseRawCorpusString(rawString: string, requiredFieldCount: number, foreachSplitLine: Function, callback: Function) {
		let fieldSeparator = ' +++$+++ ';
        let linesArray = rawString.split('\n');
        let returnArray = [];
        for (var idx=0; idx < linesArray.length; ++idx) {
            let splitLine = linesArray[idx].split(fieldSeparator);
            if (splitLine.length != requiredFieldCount) {
                console.log(`Found a splitLine of invalid length '${splitLine.length}'; expected ${requiredFieldCount}`);
                continue; 
            }
            foreachSplitLine(splitLine);
        }
        callback(returnArray);
    }
    
    parseRawMoviesString(movies: string): void {
        this.parseRawCorpusString(
            movies, 6,
            function(splitLine: string[]) {
                var movieId = parseInt(splitLine[0].substring(1));
                var title = splitLine[1];
                var year = parseInt(splitLine[2]);
                var rating = parseFloat(splitLine[3]);
                var voteCount = parseInt(splitLine[4]);
                //var genres = splitLine[5]; // TODO: split this into something useful
                this.movies[movieId.toString()] = new Movie(title, year, rating, voteCount, movieId);
                this.movieIds.push(movieId);
            },
            function() { this.parsedMovies = true; }
        )
    }
    parseRawCharactersString(characters: string): void {
        this.parseRawCorpusString(
            characters, 6,
            function(splitLine: string[]) {
                var charId = parseInt(splitLine[0].substring(1));
                var charName = splitLine[1];
                var movieId = parseInt(splitLine[2].substring(1));
                var movieName = splitLine[3];
                var movie = this.movies[movieId.toString()];
                var charGender = (splitLine[4] != '?') ? splitLine[4] : null;
                var creditsPosition = parseInt(splitLine[5]);
                this.characters[charId.toString()] = new Character(charName, movie, movieId, charGender, creditsPosition);
                this.characterIds.push(charId);
            },
            function() { this.parsedCharacters = true; }
        )
    }
    parseRawLinesString(lines: string): void {
        this.parseRawCorpusString(
            lines, 5,
            function(splitLine: string[]) {
                var lineId = parseInt(splitLine[0].substring(1));
                var charId = parseInt(splitLine[1].substring(1));
                var character = this.characters[charId.toString()];
                var movieId = parseInt(splitLine[2].substring(1));
                var movie = this.movies[movieId.toString()];
                var charName = splitLine[3];
                var text = splitLine[4];
                this.lines[lineId.toString()] = new DialogLine(character, movie, text, lineId);
                this.lineIds.push(lineId);
            },
            function() { this.parsedLines = true; }
        )
    }
    parseRawConversationsString(conversations: string): void {
        this.parseRawCorpusString(
            conversations, 4, 
            function(splitLine: string[]) { 
                var char1Id = parseInt(splitLine[0].substring(1));
                var char2Id = parseInt(splitLine[1].substring(1));
                let characters = [this.characters[char1Id.toString()], this.characters[char2Id.toString()]]
                let movieId = parseInt(splitLine[2].substring(1));
                let movie = this.movies[movieId.toString()];
                let lineIdStrings = splitLine[3].match( RegExp('L\d+') );
                var lineObjects = [];
                for (var idy=0; idy < lineIdStrings.length; ++idy) {
                    let lineId = lineIdStrings[idy];
                    let lineObj = this.lines[lineId];
                    lineObjects.push(lineObj);
                }
                this.conversations.push(new Conversation(characters, movie, lineObjects));
            },
            function() { this.parsedConversations = true; }
        )
    }
    

	/*
	parseCorpus(characters: string, conversations: string, lines: string, movies: string): void {
		let fieldSeparator = ' +++$+++ ';
		var idx;
		
		var moviesArray = movies.split('\n');
		for (idx=0; idx < moviesArray.length; ++idx) { 
			var splitLine = moviesArray[idx].split(fieldSeparator);
			if (splitLine.length < 6) { continue; } // empty or invalid line
			var movieId = parseInt(splitLine[0].substring(1));
			var title = splitLine[1];
			var year = parseInt(splitLine[2]);
			var rating = parseFloat(splitLine[3]);
			var voteCount = parseInt(splitLine[4]);
			//var genres = splitLine[5]; // TODO: split this into something useful
			this.movies[movieId.toString()] = new Movie(title, year, rating, voteCount, movieId);
			this.movieIds.push(movieId);
		}
		
		var charactersArray = characters.split('\n');
		for (idx=0; idx < charactersArray.length; ++idx) {
			var splitLine = charactersArray[idx].split(fieldSeparator);
			if (splitLine.length < 6) { continue; } // empty or invalid line
			//console.log(`PROCESSING CHARACTER ${idx.toString()}`)
			//for (var idy=0; idy<splitLine.length; ++idy) { console.log(splitLine[idy]) }
			var charId = parseInt(splitLine[0].substring(1));
			var charName = splitLine[1];
			var movieId = parseInt(splitLine[2].substring(1));
			var movieName = splitLine[3];
			var movie = this.movies[movieId.toString()];
			var charGender = (splitLine[4] != '?') ? splitLine[4] : null;
			var creditsPosition = parseInt(splitLine[5]);
			this.characters[charId.toString()] = new Character(charName, movie, movieId, charGender, creditsPosition);
			this.characterIds.push(charId);
		}
		
		var linesArray = lines.split('\n'); 
		for (idx=0; idx < linesArray.length; ++idx) {
			var splitLine = linesArray[idx].split(fieldSeparator);
			if (splitLine.length < 5) { continue; } // empty or invalid line
			var lineId = parseInt(splitLine[0].substring(1));
			var charId = parseInt(splitLine[1].substring(1));
			var character = this.characters[charId.toString()];
			var movieId = parseInt(splitLine[2].substring(1));
			var movie = this.movies[movieId.toString()];
			var charName = splitLine[3];
			var text = splitLine[4];
			this.lines[lineId.toString()] = new DialogLine(character, movie, text, lineId);
			this.lineIds.push(lineId);
		}
		
		var conversationsArray = conversations.split('\n');
		let lineIdRegex = RegExp('L\d+');
		for (idx=0; idx < linesArray.length; ++idx) {
			var splitLine = linesArray[idx].split(fieldSeparator);
			if (splitLine.length < 4) { continue; } // empty or invalid line
			var char1Id = parseInt(splitLine[0].substring(1));
			var char2Id = parseInt(splitLine[1].substring(1));
			let characters = [this.characters[char1Id.toString()], this.characters[char2Id.toString()]]
			let movieId = parseInt(splitLine[2].substring(1));
			let movie = this.movies[movieId.toString()];
			let lineIdStrings = splitLine[3].match(lineIdRegex);
			var lineObjects = [];
			for (var idy=0; idy < lineIdStrings.length; ++idy) {
				let lineId = lineIdStrings[idy];
				let lineObj = this.lines[lineId];
				lineObjects.push(lineObj);
			}
			this.conversations.push(new Conversation(characters, movie, lineObjects));
		}
	}
    */
}

console.log("Attempting to parse corpus data...");
let corpus = new Corpus();
console.log("Successfully parsed corpus data!");
console.log(` -  ${corpus.movieIds.length} movies`);
console.log(` -  ${corpus.characterIds.length} characters`);
console.log(` -  ${corpus.lineIds.length} lines`);
console.log(` -  ${corpus.conversations.length} conversations`);
console.log(`Just parsed a corpus with ${corpus.movieIds.length} movies`);
