let SpotifyWebApi = require('spotify-web-api-node');
const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const port = process.env.port || 8080;  
const isrcID = "USEE10001993"  // Replace ISRC here

const scopes = [
    'ugc-image-upload',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming',
    'app-remote-control',
    'user-read-email',
    'user-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-read-private',
    'playlist-modify-private',
    'user-library-modify',
    'user-library-read',
    'user-top-read',
    'user-read-playback-position',
    'user-read-recently-played',
    'user-follow-read',
    'user-follow-modify'
];

let  spotifyApi = new SpotifyWebApi({
    clientId: 'c95689a95692464dbebd520df5efb853',
    clientSecret: '2679fa48bfc3434fa2c9570389f94ca9',
    redirectUri: `http://localhost:${port}/callback`
})

const app = express();
app.use(express.json());

app.get('/login', (req, res) => {
    res.redirect(spotifyApi.createAuthorizeURL(scopes));
})

app.get('/callback', (req, res) => {
    const error = req.query.error;
    const code = req.query.code;
    const state = req.query.state;
  
    if (error) {
      console.error('Callback Error:', error);
      res.send(`Callback Error: ${error}`);
      return;
    }
  
    spotifyApi
      .authorizationCodeGrant(code)
      .then(data => {
        
        const access_token = data.body['access_token'];
        const refresh_token = data.body['refresh_token'];
        const expires_in = data.body['expires_in'];
  
        spotifyApi.setAccessToken(access_token);
        spotifyApi.setRefreshToken(refresh_token);
  
        console.log('access_token:', access_token);
        console.log('refresh_token:', refresh_token);
  
        console.log(
          `Sucessfully retreived access token. Expires in ${expires_in} s.`
        );
        res.send('Success! You can now close the window.');
  
        setInterval(async () => {
          const data = await spotifyApi.refreshAccessToken();
          const access_token = data.body['access_token'];
  
          console.log('The access token has been refreshed!');
          console.log('access_token:', access_token);
          spotifyApi.setAccessToken(access_token);
        }, expires_in / 2 * 1000);

      })
      .catch(error => {
        console.error('Error getting Tokens:', error);
        res.send(`Error getting Tokens: ${error}`);
      });
});


app.post('/createTrackByISRC', (req, res) => {
  (async() => { 
    fetch(`https://api.spotify.com/v1/search?type=track&q=isrc:${isrcID}`, { 
      method: 'GET', 
      headers: { 
        'Authorization': 'Bearer ' + 'BQAjH-v3BO1t5O_9hUl7donE7D6rHWDfk0i7ZpUpY9xB11JOnDLz5LUtZwvXsx7ws1280PrmjD9CMyrKxU-Ty5qKXOb38i2CRSflgxQq_T_0GRWiSTKCoS2Q2GSQRUu8OZhfRtkGY09g43-gk1I8qsml43On4vAQ4SsGttO7dfpXIAmZAA_U5-6OIYNzANEXABPlRB4-VYPCkya4FVukSLHBgE53W7LH_ETfLOfrqALctbhQBInTYcYe-zjdhgb8we9toSYFfkMMS0JADxF7JEyMWyopLRTIg8YL9L5kYFLOkDmAIceHwj54toIb4rvSUpPpoU4ouYZXml2Vt6zZ'
      }
    }) 
    // Parse JSON data 
    .then((response) => response.json()) 
    // Showing response 
    .then((setSpotifyData) => {
      if(setSpotifyData.tracks.items !== "" || setSpotifyData.tracks.items !== undefined ){
        
        if(setSpotifyData.tracks.items.length > 0){
          
          let findMostPopuparTrack = Object.values(setSpotifyData.tracks.items).map(ele => {
            return Math.max(ele.popularity)
          });
          let mostPopularTrack = Math.max(...findMostPopuparTrack);
      
          let popularTrack = (num) => {
            return num.popularity === mostPopularTrack
          }
          let extractMetadata = {
            'uri' : setSpotifyData.tracks.items.filter(popularTrack)[0].album.uri,
            'title' : setSpotifyData.tracks.items.filter(popularTrack)[0].album.name,
            'artist': setSpotifyData.tracks.items.filter(popularTrack)[0].album.artists[0].name,
            'image' : setSpotifyData.tracks.items.filter(popularTrack)[0].album.images[0].url,
            'popularity' : setSpotifyData.tracks.items.filter(popularTrack)[0].popularity,
            'isrc' : isrcID,
          }

          res.send({
            data: extractMetadata,
          })
        }else{
          let extractMetadata = setSpotifyData.tracks.items.map(ele => {
            return ({
                'uri' : ele.album.uri,
                'title' : ele.album.name,
                'artist' : ele.album.artists[0].name,
                'popularity' : ele.popularity,
                'image' : ele.album.images[0].url,
                'isrc' : isrcID
            })
          })

          res.send({
            data: extractMetadata,
          })
        }
      }
    }) 
    .catch(err => console.log(err))
  })();
  
})


app.listen(port, () => {
    console.log(`HTTP Server up. Now go to http://localhost:${port}/login in your browser.`)
})







//const artistID = "4tZwfgrHOc3mvqYlEYSvVi";    // For additional API
//const artistName = "Daft Punk";               // For additional API
//let setSpotifyData = {};                      // For additional API

/*
// 
//              Find by Artist ID
//              Additional API 
//
*/
/* let getByArtistID = () => {
  fetch(`https://api.spotify.com/v1/artists/${artistID}`, { 
    method: 'GET', 
    headers: { 
      'Authorization': 'Bearer ' + 'BQA1jTuhD4xoCbjpntndlG_O-pAo9vxpGJ7yBT4ifKE1a-qHR3iKEjeIpAiFq384D9PgTvDBot7Vvi0-ecIbRM0v4MODZrvRlY7hdxRGdFxy_a4hZeAp23hH2tm7xWOO4nSXgSW6HWjluLVz72WLAEq-tZhf6AlPMvBMill0YZTnQlHQ2mKmMlHN9WoHge8CUv1-_SH_qJDXcque3uH70ulez2n5YhowunhxFjvJrB2COHR4XKq26xHfWtSqaou_RuGMXQ1m1I69EwXZHoD9CG8vsx8p7jIMbW6MvVA7cWAxJbyQM2Ihh0SL7AAZUPPzDtMY5NSYb5Br3esP16yk'
    }
  })
  // Parse JSON data 
  .then((response) => response.json()) 
  // Showing response 
  .then((json) => {
    console.log( JSON.stringify(json) )
    //setSpotifyData = json;
  }) 
  .catch(err => console.log(err))
} */
// Invoking function on load
//getByArtistID();



/* 
//
//              Find by Artist Name
//              Additional API 
//
*/
/* let getByArtistSearch = () => {
  let strAN = artistName.split(/[ ]+/).join('+');
  fetch(`https://api.spotify.com/v1/search?q=${strAN}&type=artist`, { 
    method: 'GET', 
    headers: { 
      'Authorization': 'Bearer ' + 'BQA1jTuhD4xoCbjpntndlG_O-pAo9vxpGJ7yBT4ifKE1a-qHR3iKEjeIpAiFq384D9PgTvDBot7Vvi0-ecIbRM0v4MODZrvRlY7hdxRGdFxy_a4hZeAp23hH2tm7xWOO4nSXgSW6HWjluLVz72WLAEq-tZhf6AlPMvBMill0YZTnQlHQ2mKmMlHN9WoHge8CUv1-_SH_qJDXcque3uH70ulez2n5YhowunhxFjvJrB2COHR4XKq26xHfWtSqaou_RuGMXQ1m1I69EwXZHoD9CG8vsx8p7jIMbW6MvVA7cWAxJbyQM2Ihh0SL7AAZUPPzDtMY5NSYb5Br3esP16yk'
    }
  })
  // Parse JSON data 
  .then((response) => response.json()) 
  // Showing response 
  .then((json) => {
    console.log( JSON.stringify(json) )
    setSpotifyData = json;
  }) 
  .catch(err => console.log(err))
}
// Invoking function on load
getByArtistSearch(); */