let readyStatus = document.querySelector('#readyStatus')
let notReadyStatus = document.querySelector('#notReadyStatus')
let myForm = document.querySelector('#myForm')
let contentArea = document.querySelector('#content')

// movie-specific elements
let titleInput = document.querySelector('#title')
let suggestions = document.querySelector('#suggestions')
let searchStatus = document.querySelector('#searchStatus')
let posterPreview = document.querySelector('#posterPreview')
let posterUrlInput = document.querySelector('#posterUrl')
let externalIdInput = document.querySelector('#externalId')
let ratingInput = document.querySelector('#rating')
let watchedDateInput = document.querySelector('#watchedDate')

// Debounce helper
const debounce = (fn, wait = 250) => {
    let t
    return (...args) => {
        clearTimeout(t)
        t = setTimeout(() => fn(...args), wait)
    }
}

// TMDB search
const searchTMDB = async (q) => {
    if (!q || q.trim().length === 0) {
        suggestions.innerHTML = ''
        suggestions.style.display = 'none'
        if (searchStatus) searchStatus.textContent = ''
        return
    }
    try {
        if (searchStatus) searchStatus.textContent = 'Searching…'
        const resp = await fetch(`/tmdb/search?q=${encodeURIComponent(q)}`)
        if (!resp.ok) {
            const txt = await resp.text().catch(() => '')
            if (searchStatus) searchStatus.textContent = 'Search failed'
            console.error('tmdb search not ok', resp.status, txt)
            suggestions.style.display = 'none'
            return
        }
        const json = await resp.json()
        const results = json.results || []
        suggestions.innerHTML = ''
        if (results.length) suggestions.style.display = 'block'
        results.forEach(r => {
            const li = document.createElement('li')
            li.tabIndex = 0
            li.className = 'suggestion'
            li.dataset.id = r.id
            li.dataset.poster = r.posterUrl || ''
            // add a small poster thumbnail in the suggestion where available
            const thumb = r.posterUrl ? `<img src="${r.posterUrl}" alt="thumb" />` : ''
            li.innerHTML = `${thumb}<div class="suggestion-meta">${r.title} ${r.release_date ? '(' + r.release_date.split('-')[0] + ')' : ''}</div>`
            li.addEventListener('click', () => selectSuggestion(r))
            li.addEventListener('keydown', (e) => { if (e.key === 'Enter') selectSuggestion(r) })
            suggestions.appendChild(li)
        })
        if (!results.length) {
            suggestions.style.display = 'none'
            if (searchStatus) searchStatus.textContent = 'No matches'
        } else {
            if (searchStatus) searchStatus.textContent = ''
        }
    } catch (err) {
        console.error('TMDB search failed', err)
    }
}

const debouncedSearch = debounce((e) => searchTMDB(e.target.value), 300)
titleInput.addEventListener('input', debouncedSearch)

const selectSuggestion = (r) => {
    titleInput.value = r.title || ''
    posterUrlInput.value = r.posterUrl || ''
    externalIdInput.value = r.id || ''
    if (r.posterUrl) {
        posterPreview.src = r.posterUrl
        posterPreview.style.display = 'block'
    } else {
        posterPreview.src = ''
        posterPreview.style.display = 'none'
    }
    suggestions.innerHTML = ''
    suggestions.style.display = 'none'
}

// keyboard navigation for suggestions
let currentIndex = -1
const focusSuggestion = (i) => {
    const items = suggestions.querySelectorAll('li.suggestion')
    if (!items || items.length === 0) return
    if (i < 0) i = -1
    currentIndex = i
    items.forEach((it, idx) => {
        if (idx === i) {
            it.classList.add('focused')
            it.focus()
        } else {
            it.classList.remove('focused')
        }
    })
}

titleInput.addEventListener('keydown', (e) => {
    const items = suggestions.querySelectorAll('li.suggestion')
    if (!items || items.length === 0) return

    if (e.key === 'ArrowDown') {
        e.preventDefault()
        currentIndex = Math.min(currentIndex + 1, items.length - 1)
        focusSuggestion(currentIndex)
    } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        currentIndex = Math.max(currentIndex - 1, -1)
        if (currentIndex === -1) titleInput.focus()
        else focusSuggestion(currentIndex)
    } else if (e.key === 'Enter') {
        // On enter, if there's a focused suggestion use it
        if (currentIndex >= 0 && items[currentIndex]) {
            e.preventDefault()
            const idx = currentIndex
            const text = items[idx].textContent
            const r = {
                id: items[idx].dataset.id,
                posterUrl: items[idx].dataset.poster,
                title: text
            }
            selectSuggestion(r)
        }
    }
})

// Hide suggestions whenever user clicks outside the input/suggestions
document.addEventListener('click', (e) => {
    if (!titleInput.contains(e.target) && !suggestions.contains(e.target)) {
        suggestions.innerHTML = ''
        suggestions.style.display = 'none'
    }
})

// listen for form submissions  
myForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (event.submitter && event.submitter.className === 'reset') {
        myForm.reset()
        posterPreview.src = ''
        suggestions.innerHTML = ''
        return
    }

    if (!titleInput.value || titleInput.value.trim() === '') {
        alert('Title is required')
        return
    }

    // If the user didn't pick a suggestion, try to fetch the first TMDB result
    if ((!posterUrlInput.value || posterUrlInput.value.trim() === '') && titleInput.value) {
        try {
            const s = await fetch(`/tmdb/search?q=${encodeURIComponent(titleInput.value.trim())}`)
            if (s.ok) {
                const js = await s.json()
                const first = (js.results && js.results[0]) ? js.results[0] : null
                if (first) {
                    posterUrlInput.value = first.posterUrl || ''
                    externalIdInput.value = first.id || ''
                    if (first.posterUrl) {
                        posterPreview.src = first.posterUrl
                        posterPreview.style.display = 'block'
                    }
                }
            }
        } catch (e) {
            console.warn('TMDB fallback failed', e)
        }
    }

    const payload = {
        title: titleInput.value.trim(),
        rating: ratingInput.value ? Number(ratingInput.value) : null,
        watchedDate: watchedDateInput.value ? new Date(watchedDateInput.value).toISOString() : null,
        posterUrl: posterUrlInput.value || null,
        externalId: externalIdInput.value || null
    }

    try {
        const response = await fetch('/data', {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            console.error('Save failed', err)
            alert('Failed to save movie')
            return
        }
        const result = await response.json()
        console.log('Saved', result)
        alert('Movie saved')
        myForm.reset()
        posterPreview.src = ''
        getData()
    } catch (err) {
        console.error(err)
        alert('Failed to save movie')
    }
})


// fetch items from API endpoint and populate the content div
const getData = async () => {
    try {
        const response = await fetch('/data')
        if (!response.ok) {
            notReadyStatus.style.display = 'block'
            return
        }
        readyStatus.style.display = 'block'
        const data = await response.json()
        contentArea.innerHTML = ''
        if (!data || data.length === 0) {
            contentArea.innerHTML = '<p><i>No movies logged yet.</i></p>'
            return
        }
                const header = document.createElement('h2')
                header.textContent = '🎬 Logged Movies'
                contentArea.appendChild(header)

                // create a responsive grid container for movie cards
                const grid = document.createElement('div')
                grid.className = 'movie-list'

                data.forEach(item => {
                        const div = document.createElement('div')
                        div.className = 'movie-item'
                        const poster = item.posterUrl ? `<img class="thumb" src="${item.posterUrl}" alt="poster" />` : ''
                        const watched = item.watchedDate ? new Date(item.watchedDate).toLocaleDateString() : 'Unknown'
                        const rating = item.rating != null ? item.rating : '—'
                        div.innerHTML = `
                                ${poster}
                                <div class="movie-meta">
                                    <h3>${item.title}</h3>
                                    <p>Rating: ${rating}</p>
                                    <p>Watched: ${watched}</p>
                                </div>
                        `
                        grid.appendChild(div)
                })

                contentArea.appendChild(grid)
    } catch (err) {
        console.error('Failed to fetch movies', err)
        notReadyStatus.style.display = 'block'
    }
}

getData()
