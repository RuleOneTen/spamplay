# TypeScript README

This is just a spike

## Requirements

- nodejs
- TypeScript

Also, required because we're using TypeScript: 

	npm install -g tsd
	tsd query node --action install

Now install my NodeJS dependenceis: 

    npm install
    tsd query sql.js --action install

In general, I want to select dependencies that do not have many - ideally, any - dependencies of their own. Keeping the dependency graph shallow means there's fewer opportunities for a dependency's dependency's dependency to fuck up compiling on Windows under Cygwin on the full moon or whatever. (These people seem to have learned nothing from CPAN. I really miss all Python's batteries on this.)

For the same reason, I'd like to avoid shelling out. This has proved to be a pain in the ass (I tried a couple of zip modules before just saying fuck it and shelling the fuck out), particularly when trying to ALSO keep a shallow dependency graph. Use your best judgement, the end result is going to suck anyway :).