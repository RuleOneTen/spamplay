#!/usr/bin/python3

import os
import re
import sys
import zipfile

import sqlalchemy as sqla


SQLABase = sqla.ext.declarative.declarative_base()


def strace():
    import pdb
    pdb.set_trace()


class Genre(SQLABase):

    __tablename__ = "genres"
    id = sqla.Column(sqla.Integer, primary_key=True)
    name = sqla.Column(sqla.String(Length=32))

    def __init__(self, name):
        self.name = name


class Movie(SQLABase):

    __tablename__ = "movies"
    id = sqla.Column(sqla.Integer, primary_key=True)
    cornell_id = sqla.Column(sqla.Integer)
    title = sqla.Column(sqla.String(64))
    year = sqla.Column(sqla.Integer)
    imdb_rating = sqla.Column(sqla.Float)
    imdb_vote_count = sqla.Column(sqla.Integer)

    genres = sqla.orm.relationship(
        "Genre",
        secondary=sqla.Table(
            'movies_genres', SQLABase.metadata,
            sqla.Column("movie_id", sqla.Integer, sqla.ForeignKey('movies.id'), primary_key=True),
            sqla.Column("genre_id", sqla.Integer, sqla.ForeignKey('genres.id'), primary_key=True)),
        backref="genres")
    # TODO: properties for characters, lines, and convos from a given movie?

    def __init__(
            self, title, year, imdb_rating, imdb_vote_count, cornell_id,
            genres=None):
        self.title = title
        self.year = year
        self.imdb_rating = imdb_rating
        self.imdb_vote_count = imdb_vote_count
        self.genres = genres
        self.cornell_id = cornell_id

    def __repr__(self):
        reprstr = "{} ({}) - {}/10 - #".format(
            self.title, self.year, self.imdb_rating, self.id)
        return reprstr


class Character(object):

    __tablename__ = "characters"
    id = sqla.Column(sqla.Integer, primary_key=True)
    cornell_id = sqla.Column(sqla.Integer)
    name = sqla.Column(sqla.String(64))
    gender = sqla.Column(sqla.String(32))
    movie_id = sqla.Column(sqla.Integer, sqla.ForeignKey('movies.id'))
    credit_position = sqla.Column(sqla.Integer)

    movie = sqla.orm.relationship("Movie", back_populates="characters")
    # TODO: properties for lines and convos for a given character

    def __init__(
            self, name, movie, cornell_id, gender=None, credit_position=None):
        self.name = name
        self.gender = gender
        self.movie = movie
        self.credit_position = credit_position
        self.cornell_id = cornell_id

    def __str__(self):
        sqla.String = "{} [{} ({})]".format(
            self.name, self.movie.title, self.movie.year)
        if self.gender:
            sqla.String += " - {}".format(self.gender)
        return sqla.String


class DialogLine(object):

    __tablename__ = "dialog_lines"
    id = sqla.Column(sqla.Integer, primary_key=True)
    cornell_id = sqla.Column(sqla.Integer)
    character_id = sqla.Column(sqla.Integer, sqla.ForeignKey("characters.id"))
    movie_id = sqla.Column(sqla.Integer, sqla.ForeignKey("movies.id"))
    conversation_id = sqla.Column(sqla.Integer, sqla.ForeignKey("conversations.id"))
    text = sqla.Column(sqla.String)  # NOTE: this needs to be unlimited in length

    character = sqla.orm.relationship("Character", back_populates="dialog_lines")
    movie = sqla.orm.relationship("Movie", back_populates="dialog_lines")
    conversation = sqla.orm.relationship("Conversation", back_populates="dialog_lines")

    def __init__(self, character, movie, text, cornell_id):
        self.character = character
        self.movie = movie
        self.text = text
        self.cornell_id = cornell_id

    def __repr__(self):
        reprstr = '<DialogLine - {}: "{}">'.format(
            self.character.name, self.text)
        return reprstr


class Conversation(object):

    # TODO: support convos with >2 participants
    __tablename__ = "conversations"
    id = sqla.Column(sqla.Integer, primary_key=True)
    character1_id = sqla.Column(sqla.Integer, sqla.ForeignKey("characters.id"))
    character2_id = sqla.Column(sqla.Integer, sqla.ForeignKey("characters.id"))
    movie_id = sqla.Column(sqla.Integer, sqla.ForeignKey("movies.id"))

    character1 = sqla.orm.relationship("Character", back_populates="conversations")
    character2 = sqla.orm.relationship("Character", back_populates="conversations")
    movie = sqla.orm.relationship("Movie", back_populates="conversations")
    lines = sqla.orm.relationship(
        "DialogLine", back_populates="conversations", order_by=DialogLine.id)

    def __init__(self, characters, movie, lines):
        self.characters = characters
        self.movie = movie
        self.lines = lines

    def __repr__(self):
        reprstr = "Conversation between '{}' from {} ({})".format(
            self.characters, self.movie.title, self.movie.year)
        return reprstr


class Corpus(object):

    def __init__(
            self,
            dbpath="{}/spamplay.sqlite".format(
                os.path.dirname(os.path.realpath(__file__)))):
        self.dbpath = dbpath
        self.movies = {}
        self.characters = {}
        self.lines = {}
        self.conversations = ()  # NOTE: list, not a dict like the others

    @staticmethod
    def fromZipfile(zipfile_path):

        newCorpus = Corpus()
        if os.path.exists(newCorpus.dbpath):
            raise Exception("Database already exist at {}".format(newCorpus.dbpath))

        corpus_zip = zipfile.ZipFile(zipfile_path, 'r')
        chars  = corpus_zip.open('cornell movie-dialogs corpus/movie_characters_metadata.txt').readlines()
        convos = corpus_zip.open('cornell movie-dialogs corpus/movie_conversations.txt').readlines()
        lines  = corpus_zip.open('cornell movie-dialogs corpus/movie_lines.txt').readlines()
        titles = corpus_zip.open('cornell movie-dialogs corpus/movie_titles_metadata.txt').readlines()
        corpus_zip.close()

        separator = ' +++$+++ '

        for line in titles:
            sl = line.split(separator)
            mid, title, year, rating, vote_count, genres = sl
            newCorpus.movies[mid] = Movie(title, year, rating, vote_count, mid)

        for line in chars:
            cid, cname, mid, mname, gender, credpos = line.split(separator)
            if gender == '?':
                gender = None
            newCorpus.characters[cid] = Character(
                cname, newCorpus.movies[mid], cid, gender=gender,
                credit_position=credpos)

        for line in lines:
            lid, cid, mid, cname, text = line.split(separator)
            newCorpus.lines[lid] = DialogLine(
                newCorpus.characters[cid], newCorpus.movies[mid], text, lid)

        lids_re = re.compile('L\d+')
        for line in convos:
            cid1, cid2, mid, lidstring = line.split(separator)
            characters = (newCorpus.characters[cid1], newCorpus.characters[cid2])
            lids = lids_re.findall(lidstring)
            lines = [newCorpus.lines[l] for l in lids]
            newConvo = Conversation(characters, newCorpus.movies[mid], lines)
            newCorpus.conversations += (newConvo, )

        return newCorpus


def main(*args, **kwargs):
    zippath = '~/Downloads/cornell_movie_dialogs_corpus.zip'
    zipnormpath = os.path.abspath(os.path.expanduser(zippath))
    corpus = Corpus.fromZipfile(zipnormpath)
    print("Successfully processed corpus data from {}: ".format(zipnormpath))
    print(" -  {} movies".format(len(corpus.movies.keys())))
    print(" -  {} characters".format(len(corpus.characters.keys())))
    print(" -  {} lines".format(len(corpus.lines.keys())))
    print(" -  {} conversations".format(len(corpus.conversations)))

if __name__ == '__main__':
    sys.exit(main(*sys.argv))
