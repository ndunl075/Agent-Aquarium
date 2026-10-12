const {app}=require('electron');
try{const db=require('better-sqlite3')(':memory:');db.prepare('select 1').get();db.close();app.exit(0);}catch{app.exit(1);}
