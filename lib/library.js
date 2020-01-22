'use strict';

const https = require('https');

const GitIgnore = {};

const request = (path, host = 'api.github.com', parse = true) => {
  const headers = {
    'User-Agent': 'gitignore node app'
  };
  const token = process.env.GITHUB_API_TOKEN;
  if (token) headers['Authorization'] = `token ${token}`;
  return new Promise((resolve, reject) => {
    https
      .get(
        {
          host,
          path,
          headers
        },
        res => {
          if (res.statusCode !== 200) {
            if (
              res.statusCode === 403 &&
              res.headers['x-ratelimit-remaining'] === '0'
            ) {
              const resetDate = new Date(
                res.headers['x-ratelimit-reset'] * 1000
              );
              reject(new Error(`Rate limit exceeded, reset ${resetDate}`));
            }

            const err = new Error('something went wrong');
            err.statusCode = res.statusCode;
            reject(err);
          }
          let body = '';
          res.on('data', chunk => {
            body += chunk;
          });
          res.on('end', () => {
            resolve(parse ? JSON.parse(body) : body);
          });
        }
      )
      .on('error', reject);
  });
};

const filterIgnoreFiles = tree => {
  const paths = tree
    .filter(file => file.path.match(/\.gitignore$/))
    .map(file => file.path.replace(/\.gitignore$/, '').split(/\//));
  paths.sort((a, b) => {
    if (a.length === 1 && b.length > 1) return -1;
    if (a.length > 1 && b.length === 1) return 1;
    return a.join(' > ').toLowerCase() > b.join(' > ').toLowerCase() ? 1 : -1;
  });
  return paths;
};

const getHeadTreeSha = () => {
  return request('/repos/github/gitignore/branches/master').then(
    data => data.commit.commit.tree.sha
  );
};

const getTree = sha => {
  return request(`/repos/github/gitignore/git/trees/${sha}?recursive=1`);
};

const getGitIgnoreFiles = () => {
  return getHeadTreeSha()
    .then(getTree)
    .then(res => {
      return filterIgnoreFiles(res.tree);
    });
};

GitIgnore.getTypes = function() {
  return getGitIgnoreFiles();
};

GitIgnore.writeFile = function(options) {
  if (!options.type) {
    return Promise.reject(new Error('no type provided'));
  }
  if (!options.file && !options.writable) {
    return Promise.reject(new Error('no writable provided'));
  }

  const type = options.type
    .replace(/\s*[\/|>|,]\s*/g, '/')
    .toLowerCase()
    .trim();

  return GitIgnore.getTypes()
    .then(files => {
      let matchedFile;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileJoined = file.join('/').toLowerCase();
        if (fileJoined === type) {
          matchedFile = file;
          break;
        }
      }
      if (!matchedFile) return Promise.reject(new Error('type does not exist'));
      return matchedFile;
    })
    .then(file => {
      return request(
        `/github/gitignore/master/${file.join('/')}.gitignore`,
        'raw.githubusercontent.com',
        false
      ).then(body => {
        return new Promise((resolve, reject) => {
          const writable = options.file || options.writable;
          writable.write(body);
          writable.end();
          writable.on('finish', resolve);
          writable.on('error', reject);
        });
      });
    });
};

module.exports = GitIgnore;
