const figlet = require("figlet");
const pc = require("picocolors");

function showBanner() {
    console.log(
        pc.green(figlet.textSync("APIForge", { font: "big" }))
    );
}

module.exports = { showBanner };