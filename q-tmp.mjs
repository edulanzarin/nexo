import { readFileSync } from "node:fs";
import pg from "pg";
for (const l of readFileSync("/home/edulanzarin/Dev/nexo/.env","utf8").split("\n")){const m=/^([A-Z0-9_]+)=(.*)$/.exec(l.trim());if(m)process.env[m[1]]??=m[2];}
const c=new pg.Client({host:process.env.QUESTOR_DB_HOST,port:Number(process.env.QUESTOR_DB_PORT??5432),database:process.env.QUESTOR_DB_NAME,user:process.env.QUESTOR_DB_USER,password:process.env.QUESTOR_DB_PASSWORD,options:"-c default_transaction_read_only=on -c statement_timeout=120000"});
await c.connect();const {rows}=await c.query(process.argv[2]);console.log(JSON.stringify(rows,null,1).slice(0,4000));await c.end();
