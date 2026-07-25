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

const cache = {
    peers: {}
}

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
peer.on("connection", conn => {
    connections.push(conn)
    conn.on("close", () => {
        connections = connections.filter(x => x !== conn);
    })
    conn.on("data", data => {
        if (data.type == "join") {
            players.push({
                name: data.name,
                peer_id: conn.peer,
                x: 0,
                y: 0,
                zoom: 1
            });
        } else if (data.type == "leave") {
            let player = players.find(p => p.peer_id === conn.peer);

            let index = players.indexOf(player);

            if (index !== -1) {
                players.splice(index, 1);
            }
        } else if (data.type == "cursor") {
            let player = players.find(p => p.peer_id === conn.peer);

            let index = players.indexOf(player);

            if (index !== -1) {
                players.splice(index, 1);
                let name = player.name;
                players.push({
                    name: name,
                    peer_id: conn.peer,
                    x: data.x,
                    y: data.y,
                    zoom: data.zoom
                });
            }
        }
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
function drawWorld() {
    drawWire(200, 100, 400, 200, 1)
    drawWire(100, 400, 200, 100, 0)
    drawGate("AND", "red", 200, 100);
    drawGate("OR", "green", 400, 200);
    drawGate("NOT", "blue", 100, 400);
}
function gameloop() {
    if (host) {
        host.send({
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
                players: cursors
            });
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
                host.send({
                    type: "leave"
                })
            }
            let conn = await connectToPeer(peer, input.value)
            myname = input2.value;
            conn.send({
                type: "join",
                name: myname
            })
            host = conn;
            host.on("data", data => {
                if (data.type == "replication") {
                    players = data.players
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
