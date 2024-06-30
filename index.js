import express from 'express';
import db from './database.js';

const app = express();
const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Servidor en http://localhost:${PORT}`)
})

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended : true }));


//Endpoints usuarios
app.post("/usuario", async (req, res) => {
    try {
        let { nombre, balance } = req.body;

        if(!nombre || !balance){
            return res.status(404).json({
                message: "Debe ingresar todos los datos solicitados."
            });
        }

        let query = {
            text: "INSERT INTO usuarios (nombre, balance) VALUES ($1, $2) RETURNING id,  nombre, balance",
            values: [nombre, balance]
        }

        let results = await db.query(query);

        let usuario = results.rows[0];

        res.status(201).json({
            message: `Usuario ${usuario.nombre} (id = ${usuario.id}) registrado con exito.`,
            usuario: results.rows[0]
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Error al registrar usuario."
        })
    }
})

app.get("/usuarios", async (req, res) => {
    try {
        let query = {
            text: "SELECT id, nombre, balance FROM usuarios ORDER BY id"
        }

        let results = await db.query(query)
        
        res.status(200).json({
            message: "Lista de usuarios obtenida con exito.",
            usuarios: results.rows
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Error al obtener la lista de usuarios."
        })
    }
})

app.delete("/usuario", async (req, res) => {
    try {
        let id = req.query.id;

        let query = {
            text: "DELETE FROM usuarios WHERE id = $1 RETURNING id, nombre, balance",
            values: [id]
        }

        let results = await db.query(query);

        if(results.rowCount <= 0){
            return res.status(400).json({
                message: "El usuario no existe."
            })
        }

        let usuario = results.rows[0];

        res.status(200).json({
            message: `Usuario ${usuario.nombre} con id ${usuario.id} eliminado exitosamente.`
        })

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Error al eliminar el usuario."
        })
    }
})

app.put("/usuario", async (req, res) => {
    try {
        let { nombre, balance } = req.body;
        let id = req.query.id;

        let query = {
            text: "UPDATE usuarios SET nombre = $1, balance = $2 WHERE id = $3 RETURNING id, nombre, balance",
            values: [nombre, balance, id]
        }

        let results = await db.query(query);

        if(results.rowCount <= 0){
            return res.status(400).json({
                message: "El usuario no existe"
            })
        }

        res.status(201).json({
            message: `Usuario ${nombre} con id ${id} actualizado con exito.`,
            usuario: results.rows[0]
        })


    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Error al actualizar los datos del usuario."
        })
    }
})


//Endpoints transferencias
app.post("/transferencia", async (req, res) => {
    try {
        let { emisor, receptor, monto } = req.body;

        if(!emisor || !receptor || !monto){
            return res.status(404).json({
                message: "Debe ingresar todos los datos solicitados."
            });
        }else if(emisor == receptor){
            return res.status(406).json({
                message: "El emisor y el receptor deben ser distintos."
            })
        }

        //Inicio de la transaccion
        await db.query("BEGIN");
        console.log("Transacción iniciada")

        //Descuento cuenta de origen
        let descontar = {
            text: "UPDATE usuarios SET balance = balance - $1 WHERE id = $2 RETURNING id, nombre, balance",
            values: [monto, emisor]
        }

        let descontarResults = await db.query(descontar);

        if(descontarResults.rowCount <= 0){
            throw new Error("La cuenta de origen no exite, revise los datos.")
        }

        let datosEmisor = descontarResults.rows[0];
        console.log(`Monto $${monto} descontado correctamente de la cuenta de ${datosEmisor.nombre}`)

        //Abono cuenta destino
        let abonar = {
            text: "UPDATE usuarios SET balance = balance + $1 WHERE id = $2 RETURNING id, nombre, balance",
            values: [monto, receptor]
        }

        let abonarResults =  await db.query(abonar);

        if(abonarResults.rowCount <= 0){
            throw new Error("La cuenta de destino no existe, revise los datos.")
        }

        let datosReceptor = abonarResults.rows[0];
        console.log(`Monto $${monto} abonado correctamente de la cuenta de ${datosReceptor.nombre}`)

        //Agregar a la tabla trasnferencias
        let transferencia = {
            text: "INSERT INTO transferencias (emisor, receptor, monto, fecha) VALUES ($1, $2, $3, $4) RETURNING id, emisor, receptor, monto, fecha",
            values: [emisor, receptor, monto, "NOW()"]
        }

        let transferenciaResults = await db.query(transferencia);

        if(transferenciaResults.rowCount <= 0){
            throw new Error("Error al registrar la transacción.")
        }

        //Fin de la transaccion
        await db.query("COMMIT")
        console.log("Transacción realizada con exito.")

        res.status(201).json({
            message: `Transferencia de $${monto} desde la cuenta de ${datosEmisor.nombre} (id = ${datosEmisor.id}) a la cuenta de ${datosReceptor.nombre} (id = ${datosReceptor.id}) realizada con exito.`,
            transferencia: transferenciaResults.rows[0]
        })
    } catch (error) {
        await db.query("ROLLBACK");
        console.log("Transacción cancelada");
        console.log(error);
        if(error.code == "23514"){
            res.status(400).json({
                message: "El emisor no tiene saldo suficiente."
            });
        }else if(error.code == "22P02"){
            res.status(400).json({
                message: "Monto ingresado no válido, revise los datos."
            });
        }else{
            res.status(400).json({
                message: error.message
            })
        }
    }
})

app.get("/transferencias", async (req, res) => {
    try {
        let query = {
            text: "SELECT t.id AS id, ue.nombre AS emisor, ur.nombre AS receptor, t.monto, t.fecha FROM transferencias AS t JOIN usuarios AS ue ON t.emisor = ue.id JOIN usuarios AS ur ON t.receptor = ur.id",
            values: []
        }

        let results = await db.query(query)
        
        res.status(200).json({
            message: "Lista de transferencias obtenida con exito.",
            transferencias: results.rows
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Error al obtener la lista de transferencias."
        })
    }
})