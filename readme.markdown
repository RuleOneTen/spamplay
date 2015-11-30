# spamplay - FINALLY, interjecting spam into screenplays

Have you ever read a screenplay and thought, "god, this is so unrealistic, there isn't any superfluous advertising"?? 

Probably not, because most movies nowadays DO have ads everywhere. But in some venerable, even ancient, scripts, modern advertising had not yet been invented, and the scripts are woefully adless. 

spamplay aims to fix this horrible problem. 

It displays screenplay dialog as group iMessage conversations between the characters - and interjects some *totally relevant* targetted advertising into them. Ahhhh. Finally. It feels just like home. 

## TODO: 

- Commit the corpus to the git repo directly 
- Running it takes 45-75 seconds - fix? 
- Save the corpus to a sqlite database on first run... would that be faster on subsequent runs? 
- find interesting convos - what's the right number of lines for something useful? 
- actually add the spam text
- web api 
    - /random: gets a random convo that fits our preferred criteria of length etc
    - /id/XXXX: gets a convo by ID
- web interface
    - should be a JS interface so this is an API + a single-page app