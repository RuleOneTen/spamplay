import fs = require("fs")
import path = require('path')

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
	
	constructor() {
		this.movies = this.characters = this.lines = {};
		this.conversations = [];
		this.movieIds = this.characterIds = this.lineIds = [];
	}
	
	parseCorpus(characters: string, conversations: string, lines: string, movies: string) {
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
	
	static constructFromZipfile(corpusZipfilePath: string) {
		throw "Not implemented";
	}
	
	static constructFromDirectory(corpusDirectory: string) {

		let chars  = fs.readFileSync(path.resolve(corpusDirectory, 'movie_characters_metadata.txt'), "utf8");
		let convos = fs.readFileSync(path.resolve(corpusDirectory, 'movie_conversations.txt'), "utf8");
		let lines  = fs.readFileSync(path.resolve(corpusDirectory, 'movie_lines.txt'), "utf8");
		let movies = fs.readFileSync(path.resolve(corpusDirectory, 'movie_titles_metadata.txt'), "utf8");
		

		let corpus = new Corpus;
		corpus.parseCorpus(chars, convos, lines, movies);
		return corpus;
	}

}

console.log("Attempting to parse corpus data...");
let corpus = Corpus.constructFromDirectory('cornell movie-dialogs corpus');
console.log("Successfully parsed corpus data!");
console.log(` -  ${corpus.movieIds.length} movies`);
console.log(` -  ${corpus.characterIds.length} characters`);
console.log(` -  ${corpus.lineIds.length} lines`);
console.log(` -  ${corpus.conversations.length} conversations`);
console.log(`Just parsed a corpus with ${corpus.movieIds.length} movies`);
