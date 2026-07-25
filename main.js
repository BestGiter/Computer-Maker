room_code = "";
host = null;
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
            y: 0,
            id: 0,
            value: 1
        },
        1: {
            name: "NOT",
            x: -100,
            y: 0,
            id: 1,
            value: 1
        },
    },
    wires: {  // this will be like id: {from: id1, to: id2, id: id, value: value}
        2: {
            _from: 1,
            _to: 0,
            id: 2
        }
    }
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
const picker = document.getElementById("filePicker");

document.getElementById("open").onclick = () => {
    picker.click();
};

picker.onchange = async () => {
    const file = picker.files[0];
    console.log(file.name);

    const text = await file.text();
    const json = JSON.parse(text)
    
};
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
function toScreen(thing, camera) {
    return {
        x: (thing.x-camera.x)/camera.zoom,
        y: (thing.y-camera.y)/camera.zoom
    };
}
function toWorld(thing, camera) {
    return {
        x: thing.x*camera.zoom+camera.x,
        y: thing.y*camera.zoom+camera.y
    };
}
function drawUI() {
    ctx.fillStyle = "white";
    ctx.font = "bold 30px monospace";
    ctx.fillText("Room: " + my_room_code, 20, 40);
}
function drawCursor(players) {
    for (const Tmouse of players) {
        ctx.fillStyle = "grey";
        ctx.beginPath();
        let screenmouse = Tmouse;
        ctx.arc(screenmouse.x, screenmouse.y, 5/Tmouse.zoom, 0, Math.PI * 2);
        ctx.fill();
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
    ctx.strokeStyle = value ? "white" : "grey";
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
function drawWorld() {
    for (const w of Object.values(world.wires)) {
        drawWire(world.gates[w._from].x, world.gates[w._from].y, world.gates[w._to].x, world.gates[w._to].y, world.gates[w._from].value);
    }
    for (const g of Object.values(world.gates)) {
        drawGate(g.name, colors[g.name], g.x, g.y)
    }
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
            inputs[gate.id] = {};
        }
        for (const wire of Object.values(world.wires)) {
            inputs[world.gates[wire._to].id] = world.gates[wire._from].value;
        }
        for (const gate of Object.values(world.gates)) {
            let output = 1;
            gate.value = output;
        }
        
    }
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);
    drawWorld();
    drawCursor(players);
    ctx.restore();
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
canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    mouse = toScreen({x: x, y: y}, camera);
    mouse.name = myname;
    mouse.zoom = camera.zoom;
    mouse.peer_id = getPeerId();
});
canvas.addEventListener("contextmenu", e => {
    e.preventDefault();
});
canvas.addEventListener("keydown", e => {
})
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
resize();
canvas.focus()
