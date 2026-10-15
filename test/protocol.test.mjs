import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
test('the packaged server initializes, lists compatible tools and rejects missing input without a network call',async()=>{
  const client=new Client({name:'release-smoke',version:'1.0.0'});
  const transport=new StdioClientTransport({command:process.execPath,args:['dist/index.js'],stderr:'pipe'});
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion().version,'1.0.1');
    const listed=await client.listTools();
    assert.deepEqual(listed.tools.map(t=>t.name).sort(),['detect_ai_image','inspect_c2pa_provenance']);
    assert.match(listed.tools.find(t=>t.name==='inspect_c2pa_provenance').description,/Does not verify/);
    const result=await client.callTool({name:'detect_ai_image',arguments:{}});
    assert.equal(result.isError,true);assert.match(result.content[0].text,/must provide/);
  } finally {await client.close();}
});
