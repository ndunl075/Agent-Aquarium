import Database from 'better-sqlite3';
import { defaultPreferences, preferencesSchema, agentStateSchema, type AquariumEventV1, type Preferences } from '@aquarium/protocol';
import { createInitialState, reduceEvent, type DomainState } from '@aquarium/domain';

export class AquariumStore {
  private db:Database.Database;
  state:DomainState=createInitialState();
  preferences:Preferences={...defaultPreferences};
  constructor(path:string){
    this.db=new Database(path);this.db.pragma('journal_mode = WAL');this.db.pragma('foreign_keys = ON');
    this.db.exec(`CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY);
      INSERT OR IGNORE INTO migrations VALUES(1);
      CREATE TABLE IF NOT EXISTS events(event_id TEXT PRIMARY KEY,occurred_at INTEGER NOT NULL,ingested_at INTEGER NOT NULL,ingest_sequence INTEGER UNIQUE NOT NULL,json_value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY CHECK(id=1),json_value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS preferences(id INTEGER PRIMARY KEY CHECK(id=1),json_value TEXT NOT NULL);`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS sessions(session_key TEXT PRIMARY KEY,provider TEXT NOT NULL,provider_session_id TEXT NOT NULL,project_label TEXT,started_at INTEGER NOT NULL,last_activity_at INTEGER NOT NULL,ended_at INTEGER,latest_status TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS agents(actor_key TEXT PRIMARY KEY,session_key TEXT NOT NULL REFERENCES sessions(session_key),provider_actor_id TEXT NOT NULL,parent_actor_key TEXT,last_status TEXT NOT NULL,context_used_percent REAL,context_source TEXT,context_observed_at INTEGER);
      CREATE INDEX IF NOT EXISTS idx_events_time ON events(occurred_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_recent ON sessions(last_activity_at DESC);`);
    const prefs=this.db.prepare('SELECT json_value FROM preferences WHERE id=1').get() as {json_value:string}|undefined;
    if(prefs){try{this.preferences=preferencesSchema.parse(JSON.parse(prefs.json_value));}catch{/* Safe defaults for corrupt preferences. */}}
    const saved=this.db.prepare('SELECT json_value FROM state WHERE id=1').get() as {json_value:string}|undefined;
    if(saved){try{const parsed=JSON.parse(saved.json_value);if(!Number.isSafeInteger(parsed.sequence)||parsed.sequence<0||!Array.isArray(parsed.seenEventIds)||parsed.seenEventIds.some((id:unknown)=>typeof id!=='string'))throw new Error('Invalid state');const agents=Object.fromEntries(Object.entries(parsed.agents).map(([key,value])=>[key,agentStateSchema.parse(value)]));this.state={agents,sequence:parsed.sequence,seenEventIds:parsed.seenEventIds.slice(-10000)};for(const agent of Object.values(this.state.agents)){if(agent.status!=='ended'){agent.status='stale';}}}catch{this.state=createInitialState();}}
    this.prune();
  }
  accept(event:AquariumEventV1):boolean{
    if(this.db.prepare('SELECT 1 FROM events WHERE event_id=?').get(event.eventId))return false;
    const next=reduceEvent(this.state,event);if(next===this.state)return false;
    this.db.transaction(()=>{
      if(this.preferences.historyEnabled)this.db.prepare('INSERT OR IGNORE INTO events VALUES(?,?,?,?,?)').run(event.eventId,event.occurredAt,Date.now(),next.sequence,JSON.stringify(event));
      for(const agent of Object.values(next.agents)){
        this.db.prepare('INSERT OR REPLACE INTO sessions VALUES(?,?,?,?,?,?,?,?)').run(agent.sessionKey,agent.provider,agent.sessionId,agent.projectLabel??null,agent.startedAt,agent.lastActivityAt,agent.endedAt??null,agent.status);
        this.db.prepare('INSERT OR REPLACE INTO agents VALUES(?,?,?,?,?,?,?,?)').run(agent.key,agent.sessionKey,agent.actorId,agent.parentKey??null,agent.status,agent.contextUsedPercent,agent.contextSource,agent.contextObservedAt??null);
      }
      this.db.prepare('INSERT OR REPLACE INTO state VALUES(1,?)').run(JSON.stringify(next));
    })();this.state=next;return true;
  }
  setPreferences(preferences:Preferences){this.db.prepare('INSERT OR REPLACE INTO preferences VALUES(1,?)').run(JSON.stringify(preferences));this.preferences=preferences;this.prune();}
  prune(){
    const now=Date.now();this.db.prepare('DELETE FROM events WHERE ingested_at < ?').run(now-this.preferences.eventRetentionDays*86400000);
    if(!this.preferences.historyEnabled)this.db.exec('DELETE FROM events');
    for(const [key,agent]of Object.entries(this.state.agents))if((agent.endedAt??agent.lastActivityAt)<now-this.preferences.sessionRetentionDays*86400000){delete this.state.agents[key];this.db.prepare('DELETE FROM agents WHERE actor_key=?').run(key);}
    this.db.exec('DELETE FROM sessions WHERE session_key NOT IN (SELECT session_key FROM agents)');
    this.db.prepare('INSERT OR REPLACE INTO state VALUES(1,?)').run(JSON.stringify(this.state));
    // Dedup IDs are bounded by the reducer; retain live summary even with history off.
  }
  clear(){this.db.transaction(()=>this.db.exec('DELETE FROM events;DELETE FROM agents;DELETE FROM sessions;DELETE FROM state;DELETE FROM preferences;'))();this.state=createInitialState();this.preferences={...defaultPreferences};this.db.pragma('wal_checkpoint(TRUNCATE)');this.db.exec('VACUUM');}
  close(){this.db.close();}
}
