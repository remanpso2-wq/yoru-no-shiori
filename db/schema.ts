import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const rooms=sqliteTable('rooms',{code:text('code').primaryKey(),owner:text('owner').notNull(),state:text('state').notNull(),revision:integer('revision').notNull().default(0),expires:integer('expires').notNull()},t=>[index('rooms_owner_idx').on(t.owner),index('rooms_expires_idx').on(t.expires)]);
