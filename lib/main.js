'use strict';

const GitIgnore = require('./library');
const fs = require('fs');
const OS = require('os');
const pEachSeries = require('p-each-series');

(function() {
  const types = process.argv.slice(2);

  if (!types || types.length === 0) {
    console.log('Usage: gitignore [PROJECT TYPE]');
    console.log('Example: gitignore rails');
    console.log(
      'Available project types can be found by running `gitignore -types` or at https://github.com/github/gitignore'
    );
    return;
  }

  if (/^((--?)?types|-t)$/i.test(types.join())) {
    console.log('Fetching available types...');
    return GitIgnore.getTypes()
      .then(types => {
        console.log(
          types
            .map(type => {
              if (type.length > 1) type[0] = type[0].toLowerCase();
              return type.join(' / ');
            })
            .join(OS.EOL)
        );
      })
      .catch(err => {
        if (err.statusCode) {
          console.error(
            'Could not access file from GitHub. Recieved status code ' +
              err.statusCode
          );
        } else {
          console.error('An unexpected error occurred.');
          console.error(err);
        }
      });
  } else {
    return pEachSeries(types, type => {
      type = type.charAt(0).toUpperCase() + type.slice(1);
      let file = fs.createWriteStream('.gitignore', { flags: 'a' });
      if (/--\w/.test(type)) {
        GitIgnore.writeFlag(
          {
            flag: type,
            file: file
          },
          function(err) {
            if (err) {
              if (err.statusCode) {
                console.log('There is no gitignore for flag' + type);
                console.error('Error code ' + err.statusCode);
              } else {
                console.error('An unexpected error occurred.');
                console.error(err);
              }
              return;
            }
          }
        );
      } else {
        return GitIgnore.writeFile({
          type: type,
          file: file
        })
          .then(() => {
            console.log(`Created .gitignore file for flag type ${type}.`);
          })
          .catch(err => {
            if (err.statusCode) {
              console.log('There is no gitignore for ' + type);
              console.log(
                'Available project types can be found by running `gitignore -types` or at https://github.com/github/gitignore'
              );
              console.error('Recieved status code ' + err.statusCode);
            } else {
              console.error('An unexpected error occurred.');
              console.error(err);
            }
          });
      }
    });
  }
}.call(this));
