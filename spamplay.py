#!/usr/bin/python3

from __future__ import print_function

import argparse
import logging
import os
import re
import sys
import zipfile

import sqlalchemy as sqla
from sqlalchemy.ext.declarative import declarative_base

# Conditional imports
if sys.version_info.major >= 3:
    from urllib.request import urlretrieve
else:
    from urllib import urlretrieve


logging.basicConfig(level=logging.DEBUG)

SQLABase = declarative_base()

cachedir = os.path.abspath(os.path.join(os.path.dirname(os.path.realpath(__file__)), "cache"))
zipfilepath = os.path.join(cachedir, "cornell_movie_dialogs_corpus.zip")
zipfilesha1 = "c741f6b6ab15caace55bc16d9c6de266964877dc"
zipurl = "http://www.mpi-sws.org/~cristian/data/cornell_movie_dialogs_corpus.zip"
dbpath = os.path.join(cachedir, "spamplay.sqlite")
dburi = "sqlite:///" + dbpath
dbengine = sqla.create_engine(dburi, echo=True)
sessionmaker = sqla.orm.sessionmaker(bind=dbengine)


def strace():
    import pdb
    pdb.set_trace()


class Genre(SQLABase):

    __tablename__ = "genres"
    id = sqla.Column(sqla.Integer, primary_key=True)
    name = sqla.Column(sqla.String(32))

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


class Character(SQLABase):

    __tablename__ = "characters"
    id = sqla.Column(sqla.Integer, primary_key=True)
    cornell_id = sqla.Column(sqla.Integer)
    name = sqla.Column(sqla.String(64))
    gender = sqla.Column(sqla.String(32))
    movie_id = sqla.Column(sqla.Integer, sqla.ForeignKey('movies.id'))
    credit_position = sqla.Column(sqla.Integer)

    movie = sqla.orm.relationship("Movie", backref="characters")
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


class DialogLine(SQLABase):

    __tablename__ = "dialog_lines"
    id = sqla.Column(sqla.Integer, primary_key=True)
    cornell_id = sqla.Column(sqla.Integer)
    character_id = sqla.Column(sqla.Integer, sqla.ForeignKey("characters.id"))
    movie_id = sqla.Column(sqla.Integer, sqla.ForeignKey("movies.id"))
    conversation_id = sqla.Column(sqla.Integer, sqla.ForeignKey("conversations.id"))
    text = sqla.Column(sqla.String)  # NOTE: this needs to be unlimited in length

    character = sqla.orm.relationship("Character", backref="dialog_lines")
    movie = sqla.orm.relationship("Movie", backref="dialog_lines")

    def __init__(self, character, movie, text, cornell_id):
        self.character = character
        self.movie = movie
        self.text = text
        self.cornell_id = cornell_id

    def __repr__(self):
        reprstr = '<DialogLine - {}: "{}">'.format(
            self.character.name, self.text)
        return reprstr


class Conversation(SQLABase):

    # TODO: support convos with >2 participants
    __tablename__ = "conversations"
    id = sqla.Column(sqla.Integer, primary_key=True)
    character1_id = sqla.Column(sqla.Integer, sqla.ForeignKey("characters.id"))
    character2_id = sqla.Column(sqla.Integer, sqla.ForeignKey("characters.id"))
    movie_id = sqla.Column(sqla.Integer, sqla.ForeignKey("movies.id"))

    character1 = sqla.orm.relationship("Character", backref="conversations")
    character2 = sqla.orm.relationship("Character", backref="conversations")
    movie = sqla.orm.relationship("Movie", backref="conversations")
    lines = sqla.orm.relationship(
        "DialogLine", backref="conversations", order_by=DialogLine.id)

    def __init__(self, characters, movie, lines):
        self.characters = characters
        self.movie = movie
        self.lines = lines

    def __repr__(self):
        reprstr = "Conversation between '{}' from {} ({})".format(
            self.characters, self.movie.title, self.movie.year)
        return reprstr


def downloadCorpusZip():
    logging.info("Downloading zipfile from '{}' to '{}'...".format(zipurl, zipfilepath))
    urlretrieve(zipurl, zipfilepath)


def parseCorpusZip(zipfile_path):

    logging.info("Parsing corpus from zipfile...")

    # if os.path.exists(newCorpus.dbpath):
    #     raise Exception("Database already exist at {}".format(newCorpus.dbpath))

    session = sessionmaker()

    zipfile_path = os.path.abspath(os.path.expanduser(zipfile_path))
    corpus_zip = zipfile.ZipFile(zipfile_path, 'r')
    chars  = corpus_zip.open('cornell movie-dialogs corpus/movie_characters_metadata.txt').readlines()
    convos = corpus_zip.open('cornell movie-dialogs corpus/movie_conversations.txt').readlines()
    lines  = corpus_zip.open('cornell movie-dialogs corpus/movie_lines.txt').readlines()
    titles = corpus_zip.open('cornell movie-dialogs corpus/movie_titles_metadata.txt').readlines()
    corpus_zip.close()

    separator = ' +++$+++ '

    for line in titles:
        line = str(line)
        mid, title, year, rating, vote_count, genres = line.split(separator)
        newmovie = Movie(title, year, rating, vote_count, mid)
        session.add(newmovie)
    session.commit()

    for line in chars:
        line = str(line)
        cid, cname, mid, mname, gender, credpos = line.split(separator)
        if gender == '?':
            gender = None
        movie = session.query(Movie).filter(Movie.cornell_id==mid)
        newchar = Character(
            cname, movie, cid, gender=gender,
            credit_position=credpos)
        session.add(newchar)
    session.commit()

    for line in lines:
        line = str(line)
        lid, cid, mid, cname, text = line.split(separator)
        character = session.query(Character).filter(Character.cornell_id==cid)
        movie = session.query(Movie).filter(Movie.cornell_id==mid)
        newline = DialogLine(character, movie, text, lid)
        session.add(newline)
    session.commit()

    lids_re = re.compile('L\d+')
    for line in convos:
        line = str(line)
        cid1, cid2, mid, lidstring = line.split(separator)
        characters = (
            session.query(Character).filter(Character.cornell_id==cid1),
            session.query(Character).filter(Character.cornell_id==cid2))
        lineids = lids_re.findall(lidstring)
        lines = [session.query(DialogLine).filter(DialogLine.cornell_id==lid) for lid in lineids]
        movie = session.query(Movie).filter(Movie.cornell_id==mid)
        newconvo = Conversation(characters, movie, lines)
        session.add(newconvo)
    session.commit()


def main(*args, **kwargs):
    parser = argparse.ArgumentParser(description="Miss spam? Here's more!")
    parser.add_argument('--purge', '-p', action='store_true',
                        help='Nuke the database & reinitialize')

    parsed = parser.parse_args()

    if parsed.purge:
        logging.info("Purging existing database from '{}', if present".format(dbpath))
        try:
            os.remove(dbpath)
        except OSError:
            # Either path doesn't exist OR we have no permission; hope it's the former
            pass

    if not os.path.isfile(dbpath):
        if not os.path.isfile(zipfilepath):
            downloadCorpusZip()
        SQLABase.metadata.create_all(dbengine)
        parseCorpusZip(zipfilepath)

    session = sessionmaker()
    session.query(Movie).count()

    print("Successfully processed corpus data from zip")
    print(" -  {} movies".format( session.query(Movie).count() ))
    print(" -  {} characters".format( session.query(Character).count() ))
    print(" -  {} lines".format( session.query(DialogLine).count() ))
    print(" -  {} conversations".format( session.query(Conversation).count() ))


if __name__ == '__main__':
    sys.exit(main(*sys.argv))
