fetch('data/projects.json')
    .then(res => res.json())
    .then(projects => {
        const container = document.getElementById('projects')

        projects.forEach(project => {
            const card = document.createElement('div')
            card.className = "card"

            card.innerHTML = `
                <a href="project.html?id=${project.id}">
                    <img class="work-picture" src="${project.view}" loading="lazy"/><br>
                    <h3>${project.title}</h3><br>
                    <div class="detail">${project.type}</div>
                </a>
            `
            container.appendChild(card)
        })
    })