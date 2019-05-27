const axios = require('axios')
const cheerio = require('cheerio')
var mysql      = require('mysql')
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : '',
  database : 'curltest'
})

const baseURL = 'https://www.meted.ucar.edu'
const courseArr = []
let highestPgNum = null

const processCoursesPage = (pgNum) => { axios.get(`${baseURL}/training_detail.php?page=${pgNum}&languageSorting=1`).then(async res => {
    if(res.status === 200) {
      const $ = cheerio.load(res.data)

      //check you have a constant of 40 per page (unless it's the lst page, then don't need to check)
      $('ul.mod.detail_view.group').each((i, el) => {
        const courseObj = {}
        courseObj.titleEn =  $(el).find('.module_title h5 a').text().trim()
        courseObj.publishDateEn =  $(el).find('strong:contains("Publish Date")')[0].next.data
        courseObj.completionTime =  $(el).find('strong:contains("Completion Time")')[0].next.data
        courseObj.imageSrcEn =  `https://www.meted.ucar.edu${$(el).find('li.thumbnail a img')[0].attribs.src}`
        courseObj.descriptionEn =  $(el).find('li.description p')[0].children[0].data
        courseObj.topicsArr = []
        
        $(el)
          .find('.module_title a[href*="training_detail"]')
          .each((i, el) => {
            courseObj.topicsArr.push($(el).text())
          })
          courseObj.topics = courseObj.topicsArr.reduce((list, topic) => list + ', ' + topic).trimRight(', ')

        // const enLink =  $(el)
        // .find('.module_title a[href*="training_module"]:contains("English")')
        // courseObj.enURL = enLink.length ? `${baseURL}/${enLink[0].attribs.href}` : ''
        // courseObj.descriptionEn =  ''

        const frLink =  $(el)
          .find('.module_title a[href*="training_module"]:contains("French")')
        courseObj.frURL = frLink.length ? `${baseURL}/${frLink[0].attribs.href}` : ''
        courseObj.titleFr = ''
        courseObj.descriptionFr = ''
        courseObj.publishDateFr = ''

        courseArr.push(courseObj)
      })
      
      for(course of courseArr) {
        // if (course.enURL) {
        //   await axios.get(course.enURL).then(res => {
        //     if (res.status === 200) {
        //       const $ = cheerio.load(res.data)
        //       if ($('.tab_content.description p').length) {
        //         course.descriptionEn = $('.tab_content.description p').text().trim()
        //       } else {
        //         course.descriptionEn = $('.tab_content.description').text().trim()
        //       }
        //     }
        //   })
        // }
        if (course.frURL) {
          await axios.get(course.frURL).then(res => {
            if (res.status === 200) {
              const $ = cheerio.load(res.data)
              if ($('.tab_content.description p').length) {
                course.descriptionFr = $('.tab_content.description p')[0].children[0].data.trim()
              } else {
                course.descriptionFr = $('.tab_content.description').text().trim()
              }
              course.titleFr = $('#content h3 a')[0].children[0].data.trim()
              course.publishDateFr = $('strong:contains("Publish Date")')[0].next.data.trim()
            }
          })
        }
      }
      console.log(`Processed page ${pgNum}!`)

      if(!highestPgNum) {
        let numArr = ($('a', '.page_nav').map(function (){ return $(this).text() }).get()).filter(n => !isNaN(n))
        highestPgNum = Math.max(...numArr)
      }
      if(pgNum == highestPgNum)
        insertCoursesIntoDatabase(courseArr)
      else
        processCoursesPage(pgNum + 1)
    }
  }).catch(e => {
    console.log(e)
    setTimeout(() => processCoursesPage(pgNum), 10000);
  })
}

const insertCoursesIntoDatabase = (courseArr) => {
  
  connection.connect(function(err) {
    if (err) {
      console.error('error connecting: ' + err.stack);
      return;
    }
    courseArr.forEach(course => {
      course.titleEn = course.titleEn.replace(/"/g, '&quot')
      course.descriptionEn = course.descriptionEn.replace(/"/g, '&quot')
      course.titleFr = course.titleFr.replace(/"/g, '&quot')
      course.descriptionFr = course.descriptionFr.replace(/"/g, '&quot')

      connection.query(`
        INSERT INTO test (titleEn, publishDateEn, completionTime, imageSrcEn, descriptionEn, frURL, titleFr, descriptionFr, publishDateFr, topics)
        VALUES ("${course.titleEn}", "${course.publishDateEn}", "${course.completionTime}", "${course.imageSrcEn}", "${course.descriptionEn}", "${course.frURL}", "${course.titleFr}", "${course.descriptionFr}", "${course.publishDateFr}", "${course.topics}")`, function (error, results, fields) {
        if (error)
          throw error;
        // connected!
      });
    })
    console.log('Inserted courses into database!')
  });
}

processCoursesPage(1)
