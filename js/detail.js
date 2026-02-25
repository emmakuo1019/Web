const params = new URLSearchParams(window.location.search)
const id = params.get('id')

fetch('data/projects.json')
    .then(res => res.json())
    .then(projects => {
        const project = projects.find(p => p.id === id)
        const container = document.getElementById('project-detail')

        if (!project) {
            container.innerHTML = "<h2>Project Not Found</h2>"
            return
        }

        container.innerHTML = `
    <img class="work-info-big" src="${project.cover}">
    <div class="project-title">${project.title}</div>
    <div class="word">
        ${project.description}
    </div>

    <ul class="word-info">WORKS INFO
        <li>類別 | <span>${project.type}</span></li>
        <li>設計 | <span>${project.designer}</span></li>
        <li>年份 | <span>${project.year}</span></li>
        <li>主辦單位 | <span>${project.hold}</span></li>
    </ul>
`
    })