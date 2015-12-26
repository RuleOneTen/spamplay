"use strict";

import fs = require("fs");
import path = require("path");
import http = require("http");
import subprocess = require("child_process")
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
class Corpus implements ICorpus {
	public movies:         {};
	public movieIds:       number[];
	public characters:     {};
	public characterIds:   number[];
	public lines:          {};
	public lineIds:        number[];
	public conversations:  Conversation[];
	
    // TODO: this is dumb bad design lol. REVISITREVISITREVISITREVISITREVISIT
	static corpusZipUrl      = "http://www.mpi-sws.org/~cristian/data/cornell_movie_dialogs_corpus.zip";
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
			
	constructor() {
		this.movies = this.characters = this.lines = {};
		this.conversations = [];
		this.movieIds = this.characterIds = this.lineIds = [];
        
        try { fs.mkdirSync(Corpus.spamplayCacheDir); } catch (error) {}; // TODO: throw any error except one where the dir alredy exists
        if (!(testPathExistsSync(Corpus.spamplayCacheDir))) {
            throw "You didn't get the Corpus and I'm too dumb to do it for you yet";
        }
        if (!testPathExistsSync(Corpus.corpusCacheDir)) {
            this.unzipCorpusWithShellOut();
        }

        // TODO: use some async library (ugh) to parallelize these: 
        this.parseRawMoviesString( fs.readFileSync(Corpus.moviesFile).toString() );
        this.parseRawCharactersString( fs.readFileSync(Corpus.charactersFile).toString() );
        this.parseRawLinesString( fs.readFileSync(Corpus.linesFile).toString() );
        this.parseRawConversationsString( fs.readFileSync(Corpus.conversationsFile).toString() );
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
        let returnArray = [];
        for (var idx=0; idx < linesArray.length; ++idx) {
            let line = linesArray[idx]
            if (line.length < 1) { 
                // Sometimes there is a blank newline at the end
                continue;
            }
            let splitLine = line.split(fieldSeparator);
            if (splitLine.length != requiredFieldCount) {
                var errorString  = `Found a splitLine of invalid length '${splitLine.length}'`;
                    errorString += `\nexpected ${requiredFieldCount}`;
                    errorString += `\non line ${line} of length ${line.length}`;
                console.log(errorString)
                continue; 
            }
            foreachSplitLine(splitLine);
        }
        callback(returnArray);
    }
    
    parseRawMoviesString(movies: string): void {
        this.parseRawCorpusString(
            movies, 6,
            (splitLine: string) => {
                var movieId = parseInt(splitLine[0].substring(1));
                var title = splitLine[1];
                var year = parseInt(splitLine[2]);
                var rating = parseFloat(splitLine[3]);
                var voteCount = parseInt(splitLine[4]);
                //var genres = splitLine[5]; // TODO: split this into something useful
                this.movies[movieId.toString()] = new Movie(title, year, rating, voteCount, movieId);
                this.movieIds.push(movieId);
            },
            () => { this.parsedMovies = true; }
        )
    }
    parseRawCharactersString(characters: string): void {
        this.parseRawCorpusString(
            characters, 6,
            (splitLine: string[]) => {
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
            () => { this.parsedCharacters = true; }
        )
    }
    parseRawLinesString(lines: string): void {
        this.parseRawCorpusString(
            lines, 5,
            (splitLine: string[]) => {
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
            () => { this.parsedLines = true; }
        )
    }
    parseRawConversationsString(conversations: string): void {
        this.parseRawCorpusString(
            conversations, 4, 
            (splitLine: string[]) => { 
                var char1Id = parseInt(splitLine[0].substring(1));
                var char2Id = parseInt(splitLine[1].substring(1));
                let characters = [this.characters[char1Id.toString()], this.characters[char2Id.toString()]]
                let movieId = parseInt(splitLine[2].substring(1));
                let movie = this.movies[movieId.toString()];
                let lineIdStrings = splitLine[3].match(/L\d+/g);
                if (!lineIdStrings) { 
                    console.log(`couldn't figure out the line IDs for convo "${splitLine.join(' ')}"`)
                }
                var lineObjects = [];
                for (var idy=0; idy < lineIdStrings.length; ++idy) {
                    let lineId = lineIdStrings[idy];
                    let lineObj = this.lines[lineId];
                    lineObjects.push(lineObj);
                }
                this.conversations.push(new Conversation(characters, movie, lineObjects));
            },
            () => { this.parsedConversations = true; }
        )
    }
}

console.log("Attempting to parse corpus data...");
let corpus = new Corpus();
console.log("Successfully parsed corpus data!");
console.log(` -  ${corpus.movieIds.length} movies`);
console.log(` -  ${corpus.characterIds.length} characters`);
console.log(` -  ${corpus.lineIds.length} lines`);
console.log(` -  ${corpus.conversations.length} conversations`);
console.log(`Just parsed a corpus with ${corpus.movieIds.length} movies`);
