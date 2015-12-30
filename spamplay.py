#!/usr/bin/env python

import os
import re
import sys
import zipfile


def strace():
    import pdb
    pdb.set_trace()


class Movie(object):

    def __init__(
            self, title, year, imdb_rating, imdb_vote_count, cornell_id,
            genres=None):
        self.title = title
        self.year = year
        self.imdb_rating = imdb_rating
        self.imdb_vote_count = imdb_vote_count
        self.genres = genres
        self.cornell_id = cornell_id

    def __str__(self):
        string = "{} ({}) - {}/10".format(
            self.title, self.year, self.imdb_rating)
        return string


class Character(object):

    def __init__(
            self, name, movie, cornell_id, gender=None, credit_position=None):
        self.name = name
        self.gender = gender
        self.movie = movie
        self.credit_position = credit_position
        self.cornell_id = cornell_id

    def __str__(self):
        string = "{} [{} ({})]".format(
            self.name, self.movie.title, self.movie.year)
        if self.gender:
            string += " - {}".format(self.gender)
        return string


class DialogLine(object):

    def __init__(self, character, movie, text, cornell_id):
        self.character = character
        self.movie = movie
        self.text = text
        self.cornell_id = cornell_id

    def __str__(self):
        string = '<DialogLine - {}: "{}">'.format(
            self.character.name, self.text)
        return string


class Conversation(object):

    def __init__(self, characters, movie, lines):
        self.characters = characters
        self.movie = movie
        self.lines = lines

    def __str__(self):
        string = "Conversation between '{}' from {} ({})".format(
            self.characters, self.movie.title, self.movie.year)
        return string


class Corpus(object):

    def __init__(self, zipfile_path):
        self.movies = {}
        self.characters = {}
        self.lines = {}
        self.conversations = ()  # NOTE: list, not a dict like the others

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
            self.movies[mid] = Movie(title, year, rating, vote_count, mid)

        for line in chars:
            cid, cname, mid, mname, gender, credpos = line.split(separator)
            if gender == '?':
                gender = None
            self.characters[cid] = Character(
                cname, self.movies[mid], cid, gender=gender,
                credit_position=credpos)

        for line in lines:
            lid, cid, mid, cname, text = line.split(separator)
            self.lines[lid] = DialogLine(
                self.characters[cid], self.movies[mid], text, lid)

        lids_re = re.compile('L\d+')
        for line in convos:
            cid1, cid2, mid, lidstring = line.split(separator)
            characters = (self.characters[cid1], self.characters[cid2])
            lids = lids_re.findall(lidstring)
            lines = [self.lines[l] for l in lids]
            newConvo = Conversation(characters, self.movies[mid], lines)
            self.conversations += (newConvo, )


def main(*args, **kwargs):
    path = '~/Downloads/cornell_movie_dialogs_corpus.zip'
    normpath = os.path.abspath(os.path.expanduser(path))
    corpus = Corpus(normpath)
    print("Successfully processed corpus data from {}: ".format(normpath))
    print(" -  {} movies".format(len(corpus.movies.keys())))
    print(" -  {} characters".format(len(corpus.characters.keys())))
    print(" -  {} lines".format(len(corpus.lines.keys())))
    print(" -  {} conversations".format(len(corpus.conversations)))

if __name__ == '__main__':
    sys.exit(main(*sys.argv))
