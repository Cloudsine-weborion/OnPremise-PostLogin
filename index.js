const dotenv = require('dotenv');
dotenv.config();

(async () => {
  const mockttp = require('mockttp');
  const fsp = require('fs/promises');

  // Create a proxy server with a self-signed HTTPS CA certificate:
  const server = mockttp.getLocal({
    https: {
      keyPath: process.env.PROXY_HTTPS_KEY_PATH,
      certPath: process.env.PROXY_HTTPS_CERT_PATH
    }
  });

  // Pass through requests and optionally add the Cookie header
  server.forAnyRequest().thenPassThrough({
    beforeRequest: async (req) => {
      let host = req.headers['host'];

      let filehandle;
      try {
        filehandle = await fsp.open('./cookies/' + host + '.json', 'r');
        let cookiesData = await filehandle.readFile({ encoding: 'utf8' });
        let cookies = JSON.parse(cookiesData);

        if (!Array.isArray(cookies)) {
          console.warn(`Cookies data for host ${host} is not an array. Converting to array.`);
          cookies = Object.values(cookies); // Convert object values to an array
        }

        let cookiesHeader = cookies.map(item => item.name + '=' + item.value);
        cookiesHeader = cookiesHeader.join('; ');

        req.headers['cookie'] = cookiesHeader;
      } catch (e) {
        console.log("No cookies found for " + host);
        console.log(e);
      } finally {
        await filehandle?.close();
      }

      console.log(req.headers);
      return req;
    }
  });

  await server.start(parseInt(process.env.PROXY_PORT));

  // Print out the server details:
  console.log(`Server running on port ${server.port}`);
})();
