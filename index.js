let SpotifyWebApi = require('spotify-web-api-node');
const mysql = require('mysql2');
const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const port = process.env.port || 8080;
const isrcID = "USEE10001993"

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

let spotifyApi = new SpotifyWebApi({
    clientId: 'c95689a95692464dbebd520df5efb853',
    clientSecret: '2679fa48bfc3434fa2c9570389f94ca9',
    redirectUri: `http://localhost:${port}/callback`
})

const app = express();
app.use(express.json());

// Database connectivity
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'spotify_data',
});

// Check if the database connection is successful
db.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to the database');
});

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
    (async () => {
        fetch(`https://api.spotify.com/v1/search?type=track&q=isrc:${isrcID}`, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + 'BQBRZOh_8ulWJDeCmKwUsNZbTJHwb7DRh5JMdpnyzBe3R9SmU5bOatHqUXa3srTB4XztdI3z8BmgyO8bFVqO6WJxL9V0Vxaq3RMU7wDFbxhpNiukhQt5AFDj6GWzlm_1DFyMDXPVNfRASCHVGHaZNOO1Pfy15ao8oHbw6-hv2WVBC8rlc_mWdACgXHN7jC014l6lAtOWl3k5eInsS1V-IGJKZSydni9YFyG_okO0HIRcI-XOw1uwvy7CgdebS-OcmWgHk5gXS-yxV3guNwVMTsOBMLfljJdsLACC2CRFr8DahTZw2HFlpi_w0jP7Z0XBTnJtCgTMbJ0ZKkNz04-Z'
            }
        })
            // Parse JSON data  
            .then((response) => response.json())
            // Showing response 
            .then((setSpotifyData) => {
                if (setSpotifyData.tracks.items !== "" || setSpotifyData.tracks.items !== undefined) {

                    if (setSpotifyData.tracks.items.length > 0) {
                        const findMostPopularTrack = Math.max(...setSpotifyData.tracks.items.map(ele => ele.popularity));
                        const mostPopularTrack = setSpotifyData.tracks.items.find(ele => ele.popularity === findMostPopularTrack);
                    
                        const extractMetadata = {
                            'uri': mostPopularTrack.album.uri,
                            'title': mostPopularTrack.album.name,
                            'image': mostPopularTrack.album.images[0].url,
                            'popularity': mostPopularTrack.popularity,
                            'isrc': isrcID,
                        };
                    
                        // Check if a record with the same values already exists in the database
                        const checkSql = `
                            SELECT * FROM track
                            WHERE uri = ? AND title = ? AND image = ? AND popularity = ? AND isrc = ?
                        `;
                    
                        db.query(checkSql, [
                            extractMetadata.uri,
                            extractMetadata.title,
                            extractMetadata.image,
                            extractMetadata.popularity,
                            extractMetadata.isrc
                        ], (checkErr, checkResults) => {
                            if (checkErr) {
                                console.error(checkErr);
                                res.status(500).json({ error: 'An error occurred while checking for existing data.' });
                            } else {
                                if (checkResults.length > 0) {
                                    // Data already exists
                                    res.send({ status: 'Data already exists', data: extractMetadata });
                                } else {
                                    // Data doesn't exist, insert it
                                    const insertSql = `
                                        INSERT INTO track (uri, title, image, popularity, isrc)
                                        VALUES (?, ?, ?, ?, ?)
                                    `;
                    
                                    db.query(insertSql, [
                                        extractMetadata.uri,
                                        extractMetadata.title,
                                        extractMetadata.image,
                                        extractMetadata.popularity,
                                        extractMetadata.isrc
                                    ], (insertErr, insertResults) => {
                                        if (insertErr) {
                                            console.error(insertErr);
                                            res.status(500).json({ error: 'An error occurred while saving data.' });
                                        } else {
                                            console.log('Data saved to the "track" table.');
                    
                                            // Retrieve the track_id of the newly inserted record
                                            const trackId = insertResults.insertId;
                    
                                            // Insert data into the "artist" table
                                            const artistSql = `
                                                INSERT INTO artist (uri, artist, isrc, track_id)
                                                VALUES (?, ?, ?, ?)
                                            `;
                    
                                            db.query(artistSql, [
                                                extractMetadata.uri,
                                                extractMetadata.title,
                                                extractMetadata.isrc,
                                                trackId
                                            ], (artistErr, artistResults) => {
                                                if (artistErr) {
                                                    console.error(artistErr);
                                                    res.status(500).json({ error: 'An error occurred while saving artist data.' });
                                                } else {
                                                    console.log('Data saved to the "artist" table.');
                                                    res.send({
                                                        sql_status: 'Data saved successfully',
                                                        data: extractMetadata,
                                                        track_id: trackId
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            }
                        });
                    }else {
                        let extractMetadata = setSpotifyData.tracks.items.map(ele => {
                            return ({
                                'uri': ele.album.uri,
                                'title': ele.album.name,
                                'artist': ele.album.artists[0].name,
                                'popularity': ele.popularity,
                                'image': ele.album.images[0].url,
                                'isrc': isrcID
                            })
                        })

                        // Check if a record with the same values already exists in the database
                        const checkSql = `
                            SELECT * FROM track
                            WHERE uri = ? AND title = ? AND image = ? AND popularity = ? AND isrc = ?
                        `;
                    
                        db.query(checkSql, [
                            extractMetadata.uri,
                            extractMetadata.title,
                            extractMetadata.image,
                            extractMetadata.popularity,
                            extractMetadata.isrc
                        ], (checkErr, checkResults) => {
                            if (checkErr) {
                                console.error(checkErr);
                                res.status(500).json({ error: 'An error occurred while checking for existing data.' });
                            } else {
                                if (checkResults.length > 0) {
                                    // Data already exists
                                    res.send({ status: 'Data already exists', data: extractMetadata });
                                } else {
                                    // Data doesn't exist, insert it
                                    const insertSql = `
                                        INSERT INTO track (uri, title, image, popularity, isrc)
                                        VALUES (?, ?, ?, ?, ?)
                                    `;
                    
                                    db.query(insertSql, [
                                        extractMetadata.uri,
                                        extractMetadata.title,
                                        extractMetadata.image,
                                        extractMetadata.popularity,
                                        extractMetadata.isrc
                                    ], (insertErr, insertResults) => {
                                        if (insertErr) {
                                            console.error(insertErr);
                                            res.status(500).json({ error: 'An error occurred while saving data.' });
                                        } else {
                                            console.log('Data saved to the "track" table.');
                    
                                            // Retrieve the track_id of the newly inserted record
                                            const trackId = insertResults.insertId;
                    
                                            // Insert data into the "artist" table
                                            const artistSql = `
                                                INSERT INTO artist (uri, artist, isrc, track_id)
                                                VALUES (?, ?, ?, ?)
                                            `;
                    
                                            db.query(artistSql, [
                                                extractMetadata.uri,
                                                extractMetadata.title,
                                                extractMetadata.isrc,
                                                trackId
                                            ], (artistErr, artistResults) => {
                                                if (artistErr) {
                                                    console.error(artistErr);
                                                    res.status(500).json({ error: 'An error occurred while saving artist data.' });
                                                } else {
                                                    console.log('Data saved to the "artist" table.');
                                                    res.send({
                                                        sql_status: 'Data saved successfully',
                                                        data: extractMetadata,
                                                        track_id: trackId
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            }
                        });
                    }
                }
            })
            .catch(err => console.log(err))
    })();

})


app.listen(port, () => {
    console.log(`HTTP Server up. Now go to http://localhost:${port}/login in your browser.`)
})
