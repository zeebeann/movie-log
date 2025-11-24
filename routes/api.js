// Below we will use the Express Router to define a series of API endpoints.
// Express will listen for API requests and respond accordingly
import express from 'express'
const router = express.Router()

// Set this to match the model name in your Prisma schema
const model = 'movie'

// Prisma lets NodeJS communicate with MongoDB
// Let's import and initialize the Prisma client
// See also: https://www.prisma.io/docs
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()


// ----- CREATE (POST) -----
// Create a new record for the configured model
// This is the 'C' of CRUD
router.post('/data', async (req, res) => {
    try {
        const { title, rating, watchedDate, posterUrl, externalId } = req.body
        if (!title) return res.status(400).send({ error: 'title is required' })
        // require rating and watchedDate
        if (rating == null) return res.status(400).send({ error: 'rating is required' })
        const r = Number(rating)
        if (isNaN(r) || r < 0.5 || r > 5 || (r * 2) % 1 !== 0) return res.status(400).send({ error: 'rating must be a number between 0.5 and 5 in 0.5 steps' })
        if (!watchedDate) return res.status(400).send({ error: 'watchedDate is required' })

        const data = {
            title,
            rating: r,
            watchedDate: new Date(watchedDate),
            posterUrl,
            externalId
        }

        const created = await prisma[model].create({ data })
        res.status(201).send(created)
    } catch (err) {
        console.error('POST /data error:', err)
        res.status(500).send({ error: 'Failed to create record', details: err.message || err })
    }
})


// ----- READ (GET) list ----- 
router.get('/data', async (req, res) => {
    try {
        // fetch first 100 movie records, newest watched first
        const result = await prisma[model].findMany({
            take: 100,
            orderBy: { watchedDate: 'desc' }
        })
        res.send(result)
    } catch (err) {
        console.error('GET /data error:', err)
        res.status(500).send({ error: 'Failed to fetch records', details: err.message || err })
    }
})



// ----- findMany() with search ------- 
// Accepts optional search parameter to filter by title field
// See also: https://www.prisma.io/docs/orm/reference/prisma-client-reference#examples-7
router.get('/search', async (req, res) => {
    try {
        // get search terms from query string, default to empty string
        const searchTerms = req.query.terms || ''
        // fetch the records from the database
        const result = await prisma[model].findMany({
            where: {
                title: {
                    contains: searchTerms,
                    mode: 'insensitive'  // case-insensitive search
                }
            },
            orderBy: { title: 'asc' },
            take: 10
        })
        res.send(result)
    } catch (err) {
        console.error('GET /search error:', err)
        res.status(500).send({ error: 'Search failed', details: err.message || err })
    }
})


// ---------- TMDB proxy endpoints ----------
// These endpoints proxy requests to TheMovieDB so the frontend doesn't need
// to hold the TMDB bearer token. Set `TMDB_BEARER` in your environment.
const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_BEARER = process.env.TMDB_BEARER

// /api/tmdb/search?q=matrix  -> searches by query
// if `q` is omitted, falls back to discover/popular
router.get('/tmdb/search', async (req, res) => {
    try {
        if (!TMDB_BEARER) return res.status(500).send({ error: 'TMDB_BEARER environment variable not set' })
        const q = req.query.q
        const url = q
            ? `${TMDB_BASE}/search/movie?query=${encodeURIComponent(q)}&language=en-US&page=1&include_adult=false`
            : `${TMDB_BASE}/discover/movie?include_adult=false&include_video=false&language=en-US&page=1&sort_by=popularity.desc`

        const resp = await fetch(url, {
            headers: {
                Authorization: `Bearer ${TMDB_BEARER}`,
                accept: 'application/json'
            }
        })
        const json = await resp.json()
        if (json.results && Array.isArray(json.results)) {
            json.results = json.results.map(r => ({
                id: r.id,
                title: r.title,
                overview: r.overview,
                release_date: r.release_date,
                posterUrl: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null
            }))
        }
        res.send(json)
    } catch (err) {
        console.error('GET /tmdb/search error:', err)
        res.status(500).send({ error: 'TMDB proxy failed', details: err.message || err })
    }
})

// /api/tmdb/movie/:id -> fetch movie details by TMDB id
router.get('/tmdb/movie/:id', async (req, res) => {
    try {
        if (!TMDB_BEARER) return res.status(500).send({ error: 'TMDB_BEARER environment variable not set' })
        const id = req.params.id
        const url = `${TMDB_BASE}/movie/${encodeURIComponent(id)}?language=en-US`
        const resp = await fetch(url, {
            headers: {
                Authorization: `Bearer ${TMDB_BEARER}`,
                accept: 'application/json'
            }
        })
        const json = await resp.json()
        const result = {
            id: json.id,
            title: json.title,
            overview: json.overview,
            release_date: json.release_date,
            posterUrl: json.poster_path ? `https://image.tmdb.org/t/p/w500${json.poster_path}` : null
        }
        res.send(result)
    } catch (err) {
        console.error('GET /tmdb/movie/:id error:', err)
        res.status(500).send({ error: 'TMDB movie fetch failed', details: err.message || err })
    }
})




// export the api routes for use elsewhere in our app 
// (e.g. in index.js )
export default router;

