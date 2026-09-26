import test from 'node:test';
import assert from 'node:assert/strict';
import {isPlatformOwner} from '../src/lib/platform-access';
test('platform operations require explicit owner ID as well as admin role',()=>{
 const old=process.env.PLATFORM_ADMIN_USER_IDS;
 try{process.env.PLATFORM_ADMIN_USER_IDS='owner';assert.equal(isPlatformOwner({id:'owner',role:'admin'}),true);assert.equal(isPlatformOwner({id:'tenant-admin',role:'admin'}),false);assert.equal(isPlatformOwner({id:'owner',role:'viewer'}),false);process.env.PLATFORM_ADMIN_USER_IDS='';assert.equal(isPlatformOwner({id:'owner',role:'admin'}),false);}finally{if(old===undefined)delete process.env.PLATFORM_ADMIN_USER_IDS;else process.env.PLATFORM_ADMIN_USER_IDS=old;}
});
