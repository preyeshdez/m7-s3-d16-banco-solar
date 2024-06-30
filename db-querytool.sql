CREATE TABLE usuarios (
id SERIAL PRIMARY KEY,
nombre VARCHAR(50),
balance FLOAT CHECK (balance >= 0)
);

select * from usuarios order by id;

CREATE TABLE transferencias (
id SERIAL PRIMARY KEY,
emisor INT,
receptor INT,
monto FLOAT,
fecha TIMESTAMP,
FOREIGN KEY (emisor) REFERENCES usuarios(id) ON DELETE CASCADE,
FOREIGN KEY (receptor) REFERENCES usuarios(id) ON DELETE CASCADE
);

select * from transferencias;

SELECT 
    t.id,
    ue.nombre AS emisor,
    ur.nombre AS receptor,
    t.monto,
    t.fecha
FROM 
    transferencias AS t
JOIN 
    usuarios AS ue ON t.emisor = ue.id
JOIN 
    usuarios AS ur ON t.receptor = ur.id
ORDER BY t.id;


