room_code = "";
host = null;
let wiring_from = null;
let wiring_to = null;
let Ptouches = [];
let Ctouches = [];
function getPeerId() {
    let id = localStorage.getItem("peer_id");

    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("peer_id", id);
    }

    return id;
}
const your_box = document.getElementById("your-code-box")
function sendToHost(host, data) {
    if (!host) {
        handleHost(getPeerId(), data)
    } else {
        host.send(data)
    }
}
const cache = {
    peers: {}
}

let world = {
    gates: {  // this will be like id: {name: name, id: id, value: value, x: x, y: y}
        0: {
            name: "AND",
            x: 0,
            y: 100,
            id: 0,
            value: 0
        },
        1: {
            name: "NOT",
            x: -100,
            y: 0,
            id: 1,
            value: 0
        },
        4: {
            name: "LEVER",
            x: -200,
            y: 0,
            id: 4,
            value: 0,
            enabled: 0
        }
    },
    wires: {  // this will be like id: {from: id1, to: id2, id: id, value: value}
        2: {
            _from: 1,
            _to: 0,
            id: 2
        },
        3: {
            _from: 4,
            _to: 1,
            id: 3
        }
    }
}
let currentId = 5;
let nextId = 5;
function newGate(name, x, y, value = 0, idoff = 0) {
    let id = currentId+idoff;
    world.gates[id] = {
        name: name,
        x: x,
        y: y,
        value: value,
        id: id
    };
    return id;
}
let menu = false;
let create_menu = document.getElementById("create");
function create_gate() {
    menu = !menu;
    if (menu) {
        let i = 0;
        for (const gate of ["AND", "OR", "NOT", "LEVER", "BUFFER"]) {
            let button = document.createElement("button");
            button.innerHTML = gate;
            button.style.position = "absolute";
            button.style.bottom = String((i+1)*40)+"px"
            button.classList.add("option");
            button.onclick = () => {
                const converted = toWorld({
                    x: canvas.width/2,
                    y: canvas.height/2
                }, camera)
                sendToHost(host, {
                    type: "creategate",
                    name: gate,
                    x: converted.x,
                    y: converted.y
                })
            };
            create_menu.appendChild(button);
            i++;
        }
    } else {
        create_menu.innerHTML = "";
    }
}
let delete_mode = false;
function delete_gate() {
    delete_mode = !delete_mode;
    wiring_mode = false;
    wiring_from = null;
    wiring_to = null;
}
function newWire(_from, _to, idoff = 0) {
    let id = currentId+idoff;
    world.wires[id] = {
        _from: _from,
        _to: _to,
        id: id
    }
    return id;
}
let wiring_mode = false;
function wire_gates() {
    wiring_mode = !wiring_mode;
    delete_mode = false;
}
function reserve(step) {
    nextId += step;
}
function step() {
    currentId = nextId;
}
function downloadWorld(world) {
    const data = JSON.stringify(world, null, 2);

    const blob = new Blob([data], { type: "application/json" });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "world.json";
    a.click();

    URL.revokeObjectURL(url);
}
function getGateAt(x, y) {
    for (const gate of Object.values(world.gates)) {
        if (gate.x <= x && x < gate.x+50) {
            if (gate.y <= y && y < gate.y+50) {
                return gate;
            }
        }
    }
    return null;
}
//const picker = document.getElementById("filePicker");

//document.getElementById("open").onclick = () => {
    //picker.click();
//};

//picker.onchange = async () => {
    //const file = picker.files[0];
    //console.log(file.name);

    //const text = await file.text();
    //const json = JSON.parse(text)
    
//};
async function connectToPeer(peer, room_code) {
    let conn2 = cache.peers[room_code];
    let conn = null;

    if (!conn2) {
        const response = await fetch("https://rendezvous-huzh.onrender.com/join", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                room_code: room_code
            })
        });

        const data = await response.json();
        const peer_id = data.peer_id;
        conn = peer.connect(peer_id)
    } else {        
        return conn2;
    }

    return new Promise((resolve, reject) => {
        conn.on("open", () => {
            cache.peers[room_code] = conn;
            resolve(conn);
        });
        conn.on("error", reject);
        conn.on("close", () => {
            delete cache.peers[room_code]
        })
    });
}

const peer = new Peer(getPeerId());

peer.on("open", id => {
    fetch("https://rendezvous-huzh.onrender.com/create", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "peer_id": id
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log(data.room_code)
        my_room_code = data.room_code
        gameloop()
    })
})
peer.on("error", err => {
    console.log(err)
})
let players = [];
let connections = [];
function handleHost(peer_id, data) {
    if (data.type == "join") {
        players.push({
            name: data.name,
            peer_id: peer_id,
            x: 0,
            y: 0,
            zoom: 1
        });
    } else if (data.type == "leave") {
        let player = players.find(p => p.peer_id === peer_id);

        let index = players.indexOf(player);

        if (index !== -1) {
            players.splice(index, 1);
        }
    } else if (data.type == "cursor") {
        let player = players.find(p => p.peer_id === peer_id);

        let index = players.indexOf(player);

        if (index !== -1) {
            players.splice(index, 1);
            let name = player.name;
            players.push({
                name: name,
                peer_id: peer_id,
                x: data.x,
                y: data.y,
                zoom: data.zoom
            });
        }
    } else if (data.type == "clickgate") {
        console.log("clickgate", data.id);
        let gate = world.gates[data.id];
        if (gate === undefined) {
            return
        }
        if (gate.name == "LEVER") {
            gate.enabled = gate.enabled!==undefined ? 1-gate.enabled : 1;
        }   
    } else if (data.type == "creategate") {
        reserve(1);
        newGate(data.name, data.x, data.y, 0, 0);
        step();
    } else if (data.type == "wiregates") {
        for (const w of Object.values(world.wires)) {
            if (w._from == data._from && w._to == data._to) {
                delete world.wires[w.id];
                return
            }
        }
        reserve(1);
        newWire(data._from, data._to, 0)
        step();
    } else if (data.type == "deletegate") {
        for (const w of Object.values(world.wires)) {
            if (w._from == data.id || w._to == data.id) {
                delete world.wires[w.id];
            }
        }
        delete world.gates[data.id];
    }
}
peer.on("connection", conn => {
    connections.push(conn)
    conn.on("close", () => {
        connections = connections.filter(x => x !== conn);
    })
    // request handling
    conn.on("data", data => {
        handleHost(conn.peer, data)
    })
})

const canvas = document.getElementById("game")
let ctx = {};
let mode = "normal";
let myname = "host";
let mouse = {
    name: myname,
    x: 0,
    y: 0,
    zoom: 1
};
let camera = {
    x: 0,
    y: 0,
    zoom: 1
};
function toWorld(thing, camera) {
    return {
        x: (thing.x-camera.x)/camera.zoom,
        y: (thing.y-camera.y)/camera.zoom
    };
}
function toScreen(thing, camera) {
    return {
        x: thing.x*camera.zoom+camera.x,
        y: thing.y*camera.zoom+camera.y
    };
}
function drawVignette() {
    const gradient = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        canvas.height * 0.3,
        canvas.width / 2,
        canvas.height / 2,
        canvas.height * 0.8
    );

    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.4)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}
function drawUI() {
    ctx.fillStyle = "white";
    ctx.font = "bold 30px monospace";
    ctx.fillText("Room: " + my_room_code, 20, 40);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(canvas.width/2-10, canvas.height/2);
    ctx.lineTo(canvas.width/2+10, canvas.height/2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(canvas.width/2, canvas.height/2-10);
    ctx.lineTo(canvas.width/2, canvas.height/2+10);
    ctx.stroke();
}
function drawCursor(players) {
    for (const Tmouse of players) {
        ctx.fillStyle = "grey";
        ctx.beginPath();
        let screenmouse = Tmouse;
        ctx.arc(screenmouse.x, screenmouse.y, 5/Tmouse.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "bold 30px monospace";
        ctx.fillText(Tmouse.name, screenmouse.x-5/Tmouse.zoom, screenmouse.y-5/Tmouse.zoom);
    }
    ctx.fillStyle = "white";
    ctx.beginPath();
    let screenmouse = mouse
    ctx.arc(screenmouse.x, screenmouse.y, 5/camera.zoom, 0, Math.PI * 2);
    ctx.fill();
}
function drawGate(name, color, x, y) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.strokeRect(x, y, 50, 50);
    ctx.fillStyle = color;
    ctx.fillText(name, x, y+50);
}
function drawWire(x1, y1, x2, y2, value) {
    ctx.strokeStyle = value===undefined ? "pink" : (value ? "white" : "grey");
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x1+50, y1+25);
    ctx.lineTo(x2, y2+25);
    ctx.stroke();
}
const colors = {
    AND: "red",
    OR: "green",
    NOT: "blue"
}
const bicolors = {
    LEVER: ["grey", "white"],
    BUFFER: ["grey", "white"]
}
function drawWorld() {
    for (const w of Object.values(world.wires)) {
        drawWire(world.gates[w._from].x, world.gates[w._from].y, world.gates[w._to].x, world.gates[w._to].y, world.gates[w._from].value);
    }
    for (const g of Object.values(world.gates)) {
        let col = colors[g.name];
        if (col === undefined) {
            col = bicolors[g.name][g.value];
        }
        drawGate(g.name, col, g.x, g.y)
    }
}
const keys = {};

window.addEventListener("keydown", e => {
    keys[e.key] = true;
});

window.addEventListener("keyup", e => {
    keys[e.key] = false;
});
function drawGrid(camera) {
    if (camera.zoom < 0.1) {
        return
    }
    const topleft = toWorld({x: 0, y: 0}, camera);
    const bottomright = toWorld({x: canvas.width, y: canvas.height}, camera);
    ctx.strokeStyle = "#202020";
    ctx.lineWidth = 1;
    for (let x = Math.floor(topleft.x/100)*100; x < Math.ceil(bottomright.x/100)*100; x += 100) {
        ctx.beginPath();
        ctx.moveTo(x, topleft.y);
        ctx.lineTo(x, bottomright.y);
        ctx.stroke();
    }
    for (let y = Math.floor(topleft.y/100)*100; y < Math.ceil(bottomright.y/100)*100; y += 100) {
        ctx.beginPath();
        ctx.moveTo(topleft.x, y);
        ctx.lineTo(bottomright.x, y);
        ctx.stroke();
    }
}
function getTouchPos(touch) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: touch.clientX-rect.left,
        y: touch.clientY-rect.top
    };
}
function gameloop() {
    if (host) {
        sendToHost(host, {
            type: "cursor",
            x: mouse.x,
            y: mouse.y,
            zoom: mouse.zoom
        })
    } else {
        for (const conn of connections) {
            let cursors = [mouse, ...players];
            cursors = cursors.filter(x => x.peer_id !== conn.peer);
            conn.send({
                type: "replication",
                players: cursors,
                state: world
            });
        }
        let inputs = {};
        for (const gate of Object.values(world.gates)) {
            inputs[gate.id] = [];
        }
        for (const wire of Object.values(world.wires)) {
            inputs[world.gates[wire._to].id].push(world.gates[wire._from].value);
        }
        for (const gate of Object.values(world.gates)) {
            let output = 1;
            let invert = false;
            let zero = false;
            if (gate.name == "OR" || gate.name == "BUFFER") {
                zero = true;
            }
            for (const input of inputs[gate.id]) {
                if (gate.name == "AND") {
                    output = output * input;
                } else if (gate.name == "OR" || gate.name == "BUFFER") {
                    output = Math.max(output - input, 0);
                    invert = true;
                } else if (gate.name == "NOT") {
                    output = Math.max(output - input, 0);
                }
            }
            if (gate.name == "LEVER") {
                output = gate.enabled!==undefined ? gate.enabled : 0;
                invert = false;
            }
            let temp = invert ? 1-output : output;
            gate.value = zero ? (inputs[gate.id].length === 0 ? 0 : temp) : temp;
        }
        
    }
    if (keys["w"]) {
        camera.y += 10/camera.zoom;
    }
    if (keys["s"]) {
        camera.y -= 10/camera.zoom;
    }
    if (keys["a"]) {
        camera.x += 10/camera.zoom;
    }
    if (keys["d"]) {
        camera.x -= 10/camera.zoom;
    }
    if (Ctouches.length === 2 && Ptouches.length === 2) {
        const p1 = toWorld(getTouchPos(Ptouches[0]), camera);
        const p2 = toWorld(getTouchPos(Ptouches[1]), camera);
        const c1 = toWorld(getTouchPos(Ctouches[0]), camera);
        const c2 = toWorld(getTouchPos(Ctouches[1]), camera);
        
        const pmid = {x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2};
        const cmid = {x: (c1.x + c2.x)/2, y: (c1.y + c2.y)/2};
        
        const pdis = Math.hypot(p2.x-p1.x, p2.y-p1.y);
        const cdis = Math.hypot(c2.x-c1.x, c2.y-c1.y);
        
        camera.zoom *= cdis/pdis;
        camera.x += cmid.x-pmid.x;
        camera.y += cmid.y-pmid.y;
    }
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);
    drawGrid(camera);
    drawWorld();
    drawCursor(players);
    ctx.restore();
    drawVignette();
    drawUI();
    requestAnimationFrame(gameloop);
}
canvas.addEventListener("mouseenter", () => {
    canvas.style.cursor = "none";
});

canvas.addEventListener("mouseleave", () => {
    canvas.style.cursor = "default";
});
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx = canvas.getContext("2d");
    ctx.font = "bold 30px monospace";
}

window.addEventListener("resize", resize);
canvas.addEventListener("mousedown", e => {
    const gate = getGateAt(mouse.x, mouse.y);
    if (gate === null) {
        return
    }
    if (wiring_mode) {
        if (wiring_from === null) {
            wiring_from = gate.id;
        } else if (wiring_to === null) {
            wiring_to = gate.id;
            wiring_mode = false;
            sendToHost(host, {
                type: "wiregates",
                _from: wiring_from,
                _to: wiring_to
            });
            wiring_from = null;
            wiring_to = null;
        }
    } else if (delete_mode) {
        delete_mode = false;
        sendToHost(host, {
            type: "deletegate",
            id: gate.id
        });
    } else {
        if (gate === null) {
            return
        }
        sendToHost(host, {
            type: "clickgate",
            id: gate.id
        });
    }
});
canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    mouse = toWorld({x: x, y: y}, camera);
    mouse.name = myname;
    mouse.zoom = camera.zoom;
    mouse.peer_id = getPeerId();
});
canvas.addEventListener("contextmenu", e => {
    e.preventDefault();
});
const input = document.getElementById("code");
const input2 = document.getElementById("name");
const enter = async e => {
    if (e.key === "Enter") {
        try {
            if (host) {
                sendToHost(host, {
                    type: "leave"
                })
            }
            let conn = await connectToPeer(peer, input.value)
            myname = input2.value;
            sendToHost(conn, {
                type: "join",
                name: myname
            })
            host = conn;
            // response handling
            host.on("data", data => {
                if (data.type == "replication") {
                    players = data.players
                    world = data.state
                }
            })
        } catch (error) {
            console.log(error)
        }
    }
}
input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
        input2.focus()
    }
});
input2.addEventListener("keydown", enter);
canvas.addEventListener("wheel", e => {
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();

    // Mouse position on canvas
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // World position before zoom
    const worldX = (mouseX - camera.x) / camera.zoom;
    const worldY = (mouseY - camera.y) / camera.zoom;

    // Change zoom
    const oldZoom = camera.zoom;

    if (e.deltaY < 0) {
        camera.zoom *= 1.1;
    } else {
        camera.zoom *= 0.9;
    }

    // Move camera so the mouse points at the same world position
    camera.x = mouseX - worldX * camera.zoom;
    camera.y = mouseY - worldY * camera.zoom;
}, { passive: false });
canvas.addEventListener("touchstart", e => {
    e.preventDefault();
    Ptouches = Ctouches;
    Ctouches = [...e.touches];
});
canvas.addEventListener("touchmove", e => {
    e.preventDefault();
    Ptouches = Ctouches;
    Ctouches = [...e.touches];
});
canvas.addEventListener("touchend", e => {
    e.preventDefault();
    Ptouches = Ctouches;
    Ctouches = [...e.touches];
});
canvas.addEventListener("touchcancel", e => {
    e.preventDefault();
    Ptouches = Ctouches;
    Ctouches = [...e.touches];
});
resize();
canvas.focus()
