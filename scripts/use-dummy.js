const fs = require('fs')

;(async () => {
  if (!fs.existsSync('./images/icon.png')) {
    fs.copyFileSync('./images/dummy.png', './images/icon.png')
  } else {
    console.log('icon exists')
  }
})()
