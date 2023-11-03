interface Template {
    [key: string]: string
}

interface HTMLElement {
    replace(data: Template, prefix?: string): void
}

enum TerritoryStatus {
    UN_MEMBER_STATE = "UN_MEMBER_STATE",
    COUNTRY_TERRITORY = "COUNTRY_TERRITORY",
    SPECIAL = "SPECIAL",
}

enum GameType {
    DEFAULT,
    PARTIAL,
    RANDOM_PARTIAL
}

type Country = {
    NAME: string
    CODE: string
    STATUS: string
}

type GameConfiguration = {
    TYPE: GameType,
    FLAG_TYPE: TerritoryStatus[]
}

// ! everything was a pain to handle
HTMLElement.prototype.replace = function (data: Template, prefix: string = "$_") {
    const alternate_prefix = "id_dlr_"
    const _this: () => HTMLElement = () => this
    for (const i in data) {
        const old = _this().innerHTML
        const span: () => HTMLElement | null = () =>
            _this().querySelector(`span.reactive#${alternate_prefix}${encodeURIComponent(i)}`)
        if (span() == null) _this().innerHTML =
            old.replace(`${prefix}${i}`, `
                <span class="reactive" id="${alternate_prefix}${encodeURIComponent(i)}"></span>`)
        span().innerText = data[i]
    }
}

function qSel<T extends HTMLElement>(selector: string): T {
    return document.querySelector(selector)
}

const canvas = qSel<HTMLCanvasElement>("#flags")
const ctx = canvas.getContext("2d")
const correctCountryCanvas = document.createElement("canvas")
const ccc_context = correctCountryCanvas.getContext("2d")

correctCountryCanvas.width = canvas.width
correctCountryCanvas.height = canvas.height

var countryToGuess = ""
var correctCountryName = ""
var tries = 0
var startTime: Date

async function loadCountries() {
    const request = await fetch("./flags/metadata/countries.json")
    const res: Country[] = await request.json()

    return res
}

function putOption(data: Country[]) {
    const selectElm = qSel("#country_list")

    while (selectElm.firstChild) {
        selectElm.removeChild(selectElm.firstChild)
    }

    for (const i of data) {
        const elm = document.createElement("div")
        elm.classList.add("country_item")
        elm.setAttribute("data-code", i.CODE)
        elm.setAttribute("data-name", i.NAME)
        elm.setAttribute("tabindex", "0")
        elm.onclick = async _ => { await guessCountry(i.CODE) }

        const textInElm = document.createElement("p")
        textInElm.innerText = i.NAME

        const imageElm = document.createElement("img")
        imageElm.src = `./flags/small/${i.CODE}.png`

        elm.append(imageElm, textInElm)
        selectElm.append(elm)
    }
}

function loadImage(url: string) {
    return new Promise((resolve: (arg0: HTMLImageElement) => void, reject) => {
        const img = new Image()

        img.onload = () => {
            resolve(img)
        }

        img.onerror = (error) => {
            reject(error)
        }

        img.src = url
    })
}

// ? https://stackoverflow.com/a/52453462/11418759
function deltaE(rgbA: number[], rgbB: number[]) {
    let labA = rgb2lab(rgbA)
    let labB = rgb2lab(rgbB)
    let deltaL = labA[0] - labB[0]
    let deltaA = labA[1] - labB[1]
    let deltaB = labA[2] - labB[2]
    let c1 = Math.sqrt(labA[1] * labA[1] + labA[2] * labA[2])
    let c2 = Math.sqrt(labB[1] * labB[1] + labB[2] * labB[2])
    let deltaC = c1 - c2
    let deltaH = deltaA * deltaA + deltaB * deltaB - deltaC * deltaC
    deltaH = deltaH < 0 ? 0 : Math.sqrt(deltaH)
    let sc = 1.0 + 0.045 * c1
    let sh = 1.0 + 0.015 * c1
    let deltaLKlsl = deltaL / (1.0)
    let deltaCkcsc = deltaC / (sc)
    let deltaHkhsh = deltaH / (sh)
    let i = deltaLKlsl * deltaLKlsl + deltaCkcsc * deltaCkcsc + deltaHkhsh * deltaHkhsh
    return i < 0 ? 0 : Math.sqrt(i)
}

function rgb2lab(rgb: number[]){
    let r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255, x = 0, y = 0, z = 0
    r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92
    g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92
    b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
    y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
    x = (x > 0.008856) ? Math.pow(x, 1/3) : (7.787 * x) + 16/116
    y = (y > 0.008856) ? Math.pow(y, 1/3) : (7.787 * y) + 16/116
    z = (z > 0.008856) ? Math.pow(z, 1/3) : (7.787 * z) + 16/116
    return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)]
}

async function drawFlag(code: string, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    const image = await loadImage(`./flags/large/${code}.png`)

    const [canvasW, canvasH] = [canvas.width, canvas.height]
    const [imgW, imgH] = [image.width, image.height]
    const scale = Math.min(canvasW / imgW, canvasH / imgH)

    const [scaledW, scaledH] = [imgW * scale, imgH * scale]
    const [offsetX, offsetY] = [(canvasW - scaledW) / 2, (canvasH - scaledH) / 2]

    ctx.clearRect(0, 0, canvasW, canvasH)
    ctx.drawImage(image, offsetX, offsetY, scaledW, scaledH)
}

function getRandomInt(min: number, max: number) {
    const byteArray = new Uint32Array(1)
    window.crypto.getRandomValues(byteArray)
    const range = max - min + 1
    const maxRange = Math.pow(2, 32)
    const randomValue = byteArray[0] / maxRange
    return Math.floor(randomValue * range) + min
}

function getDifference(a: ImageData, b: ImageData) {
    const maxDifference = 10
    const difference = new Uint8ClampedArray(a.data.length)

    for (let i = 0; i < a.data.length; i += 4) {
        if (a.data[i + 3] != 255 || b.data[i + 3] != 255) continue

        const delta = deltaE([a.data[i], a.data[i + 1], a.data[i + 2]], [b.data[i], b.data[i + 1], b.data[i + 2]])
        if (delta > maxDifference) continue

        difference[i] = a.data[i]
        difference[i + 1] = a.data[i + 1]
        difference[i + 2] = a.data[i + 2]
        difference[i + 3] = a.data[i + 3]
    }

    return difference
}

function getCombined(a: ImageData, b: ImageData) {
    const combined = new Uint8ClampedArray(a.data.length)

    for (let i = 0; i < a.data.length; i += 4) {
        if (a.data[i + 3] == 0 && b.data[i + 3] == 255) {
            combined[i] = b.data[i]
            combined[i + 1] = b.data[i + 1]
            combined[i + 2] = b.data[i + 2]
            combined[i + 3] = 255
            continue
        }

        if (a.data[i + 3] == 255) {
            combined[i] = a.data[i]
            combined[i + 1] = a.data[i + 1]
            combined[i + 2] = a.data[i + 2]
            combined[i + 3] = 255
            continue
        }
    }

    return combined
}

var updateInterval
function update(time: number, tries: number) {
    qSel("#display_info").replace({
        "time": time.toString(),
        "tries": tries.toString()
    })
}

async function begin(config: GameConfiguration) {
    tries = 0
    startTime = new Date()

    qSel("#config").classList.add("hidden")
    qSel("#game").classList.remove("hidden")
    qSel("#notice_win").classList.add("hidden")

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ccc_context.clearRect(0, 0, correctCountryCanvas.width, correctCountryCanvas.height)

    var countries = await loadCountries()
    countries = countries.sort((a, b) => a.NAME < b.NAME ? -1 : 1)
    countries = countries.filter(v => config.FLAG_TYPE.includes(v.STATUS as TerritoryStatus))
    putOption(countries)

    const finderElm = qSel<HTMLInputElement>("#country_finder")
    const countryItems = qSel("#country_list").querySelectorAll(".country_item")

    finderElm.addEventListener("input", () => {
        const content = finderElm.value.normalize().trim().toLowerCase()

        for (const i of countryItems) {
            i.classList.remove("hidden")
        }

        if (content == "") return
        for (const i of countryItems) {
            const stringContent = i.getAttribute("data-name").toLowerCase().normalize()
            if (stringContent.includes(content)) continue
            i.classList.add("hidden")
        }
    })

    const selected = countries[getRandomInt(0, countries.length)]
    countryToGuess = selected.CODE
    correctCountryName = selected.NAME

    await drawFlag(countryToGuess, correctCountryCanvas, ccc_context)

    updateInterval = setInterval(() => {
        update(Math.floor(((new Date()).getTime() - startTime.getTime()) / 1000), tries)
    }, 50)
}

async function guessCountry(countryCode: string) {
    const previousData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    await drawFlag(countryCode, canvas, ctx)

    const a = ccc_context.getImageData(0, 0, correctCountryCanvas.width, correctCountryCanvas.height)
    const b = ctx.getImageData(0, 0, canvas.width, canvas.height)

    const deltaImageData = new ImageData(getDifference(a, b), canvas.width)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const combinedImageData = new ImageData(getCombined(previousData, deltaImageData), canvas.width)
    ctx.putImageData(combinedImageData, 0, 0)

    if (countryCode == countryToGuess) {
        clearInterval(updateInterval)
        qSel("#notice_win").classList.remove("hidden")
        qSel("#notice_win").replace({
            "countries": correctCountryName
        })
        qSel("#give_up").classList.add("hidden")
        return
    }

    tries++
}

;
(async () => {
    document.querySelector(".game_type").setAttribute("checked", "")
    document.querySelectorAll(".flag_type").forEach(v => {
        v.setAttribute("checked", "")
    })

    document.querySelectorAll(".game_type").forEach(v => {
        const infoElm = qSel(`p.type_info[data-type="${v.getAttribute("data-attribute")}"]`)

        if (!v["checked"]) {
            infoElm.classList.add("hidden")
        }

        v.addEventListener("click", () => {
            document.querySelectorAll(`p.type_info`)
                .forEach(elm => elm.classList.add("hidden"))
            infoElm.classList.remove("hidden")
        })
    })

    qSel("#letsgo").addEventListener("click", async () => {
        const type = [...document.querySelectorAll(".game_type")].filter(v => v["checked"])[0].getAttribute("data-attribute")
        const flagType = [...document.querySelectorAll(".flag_type")].filter(v => v["checked"]).map(v => TerritoryStatus[v.getAttribute("data-attribute")])
        if (flagType.length <= 0) {
            alert("Please select at least 1 flag type!")
            return
        }

        await begin({
            TYPE: GameType[type],
            FLAG_TYPE: flagType
        })
    })

    qSel("#give_up").addEventListener("click", () => {
        clearInterval(updateInterval)
        qSel("#notice_give_up").classList.remove("hidden")
        qSel("#notice_give_up").replace({
            "countries": correctCountryName
        })
        qSel("#give_up").classList.add("hidden")

        const correctImageData = ccc_context.getImageData(0, 0, correctCountryCanvas.width, correctCountryCanvas.height)
        ctx.putImageData(correctImageData, 0, 0)
    })

    qSel("#reset_game").addEventListener("click", () => location.reload())
})()