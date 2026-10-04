fetch('data/projects.json')
    .then(res => res.json())
    .then(projects => {
        const container = document.getElementById('projects')

        projects.forEach(project => {
            const card = document.createElement('article')
            card.className = "card"

            const cleanTitle = project.title.replace(/<br\s*[\/]?>/gi, ' ')

            card.innerHTML = `
                <a class="card-link" href="project.html?id=${encodeURIComponent(project.id)}">
                    <img class="work-picture" src="${project.view}" alt="${cleanTitle} 作品縮圖" loading="lazy"/>
                    <h3 class="card-title">${project.title}</h3>
                    <div class="detail">${project.type}</div>
                </a>
            `
            container.appendChild(card)
        })
    })