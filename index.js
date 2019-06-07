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
let courseArr = []
let highestPgNum = null
let courseNum = null

const processEnglishCoursesByPage = (pgNum) => { axios.get(`${baseURL}/training_detail.php?page=${pgNum}&languageSorting=1`).then(async res => {
    if(res.status === 200) {
      const $ = cheerio.load(res.data)

      if(!courseNum)
        courseNum = $('.mod_count','.module_listing.detail_view').find('strong')[1].children[0].data

      $('ul.mod.detail_view.group').each((i, el) => {
        const courseObj = {}
        courseObj.titleEn =  $(el).find('.module_title h5 a').text().trim()
        courseObj.publishDateEn =  $(el).find('strong:contains("Publish Date")')[0].next.data
        courseObj.lastUpdatedEn =  $(el).find('strong:contains("Last Updated On")').length ? $(el).find('strong:contains("Last Updated On")')[0].next.data : ''
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

        const enLink =  $(el)
        .find('.module_title a[href*="training_module"]:contains("English")')
        courseObj.enURL = enLink.length ? `${baseURL}/${enLink[0].attribs.href}` : ''

        courseArr.push(courseObj)
      })

      console.log(`Processed page ${pgNum}!`)

      if(!highestPgNum) {
        let numArr = ($('a', '.page_nav').map(function (){ return $(this).text() }).get()).filter(n => !isNaN(n))
        highestPgNum = Math.max(...numArr)
      }
      if(pgNum == highestPgNum) {
        if(courseArr.length < courseNum)
          throw new Error('Number of courses scraped is less than total number of courses.')
        insertEnglishCoursesIntoDatabase(courseArr)
      }
      else
        processEnglishCoursesByPage(pgNum + 1)
    }
  }).catch(e => {
    console.log(e)
    setTimeout(() => processEnglishCoursesByPage(pgNum), 5000); // only retry if timeout/connection error...?
  })
}

const insertEnglishCoursesIntoDatabase = (courseArr) => {
  
  connection.connect(function(err) {
    if (err) {
      console.error('error connecting: ' + err.stack);
      return;
    }
    courseArr.forEach(course => {
      course.titleEn = course.titleEn.replace(/"/g, '&quot;')
      course.descriptionEn = course.descriptionEn.replace(/"/g, '&quot;')

      connection.query(`
        INSERT INTO comet_english (titleEn, publishDateEn, lastUpdatedEn, completionTime, imageSrcEn, descriptionEn, enURL, topics)
        VALUES ("${course.titleEn}", "${course.publishDateEn}", "${course.lastUpdatedEn}", "${course.completionTime}", "${course.imageSrcEn}", "${course.descriptionEn}", "${course.enURL}", "${course.topics}")`, function (error, results, fields) {
        if (error)
          throw error;
        // connected!
      });
    })
    console.log('Inserted courses into database!')
  });
}

const processFrenchCoursesByPage = (pgNum) => { axios.get(`${baseURL}/training_detail.php?page=${pgNum}&languageSorting=2`).then(async res => {
    if(res.status === 200) {
      const $ = cheerio.load(res.data)

      if(!courseNum)
        courseNum = $('.mod_count','.module_listing.detail_view').find('strong')[1].children[0].data

      let courseNodesArr = $('ul.mod.detail_view.group').toArray()

      for(let el of courseNodesArr) {
        const courseObj = {}
        courseObj.titleFr =  $(el).find('.module_title h5 a').text().trim()
        courseObj.publishDateFr =  $(el).find('strong:contains("Publish Date")')[0].next.data
        courseObj.lastUpdatedFr =  $(el).find('strong:contains("Last Updated On")').length ? $(el).find('strong:contains("Last Updated On")')[0].next.data : ''
        courseObj.completionTime =  $(el).find('strong:contains("Completion Time")')[0].next.data
        courseObj.imageSrcFr =  `https://www.meted.ucar.edu${$(el).find('li.thumbnail a img')[0].attribs.src}`
        //courseObj.descriptionFr =  $(el).find('li.description p')[0].children[0].data
        courseObj.descriptionFr = ''
        courseObj.topicsArr = []
        
        $(el)
          .find('.module_title a[href*="training_detail"]')
          .each((i, el) => {
            courseObj.topicsArr.push($(el).text())
          })
          courseObj.topics = courseObj.topicsArr.reduce((list, topic) => list + ', ' + topic).trimRight(', ')

        const frLink =  $(el)
          .find('.module_title a[href*="training_module"]:contains("French")')
        courseObj.frURL = frLink.length ? `${baseURL}/${frLink[0].attribs.href}` : ''

        const enLink =  $(el)
        .find('.module_title a[href*="training_module"]:contains("English")')
        courseObj.enURL = enLink.length ? `${baseURL}/${enLink[0].attribs.href}` : ''

        let res = await axios.get(courseObj.frURL);
        if (res.status === 200) {
          const $ = await cheerio.load(res.data)
          if ($('.tab_content.description p').length) {
            courseObj.descriptionFr = await $('.tab_content.description p')[0].children[0].data.trim()
          } else {
            courseObj.descriptionFr = await $('.tab_content.description')[0].children[0].data.trim()
          }
        }

        courseArr.push(courseObj)
      }

      console.log(`Processed page ${pgNum}!`)

      if(!highestPgNum) {
        let numArr = ($('a', '.page_nav').map(function (){ return $(this).text() }).get()).filter(n => !isNaN(n))
        highestPgNum = Math.max(...numArr)
      }
      if(pgNum == highestPgNum) {
        if(courseArr.length < courseNum)
          throw new Error('Number of courses scraped is less than total number of courses.')
        insertFrenchCoursesIntoDatabase(courseArr)
      }
      else
      processFrenchCoursesByPage(pgNum + 1)
    }
  }).catch(e => {
    console.log(e)
    setTimeout(() => processFrenchCoursesByPage(pgNum), 5000);
  })
}

const insertFrenchCoursesIntoDatabase = (courseArr) => {

  connection.connect(function(err) {
    if (err) {
      console.error('error connecting: ' + err.stack);
      return;
    }
    courseArr.forEach(course => {
      course.titleFr = course.titleFr.replace(/"/g, '&quot;')
      course.descriptionFr = course.descriptionFr.replace(/"/g, '&quot;')

      connection.query(`
      INSERT INTO comet_french (titleFr, publishDateFr, lastUpdatedFr, completionTime, imageSrcFr, descriptionFr, frURL, enURL, topics)
      VALUES ("${course.titleFr}", "${course.publishDateFr}", "${course.lastUpdatedFr}", "${course.completionTime}", "${course.imageSrcFr}", "${course.descriptionFr}", "${course.frURL}", "${course.enURL}", "${course.topics}")`, function (error, results, fields) {
        if (error)
          throw error;
        // connected!
      });
    })
    console.log('Inserted courses into database!')
  });
}

// processEnglishCoursesByPage(1)
// highestPgNum = null
// courseArr = []
// courseNum = null
processFrenchCoursesByPage(1)

// for(course of courseArr) {
//    if (course.enURL) {
//      await axios.get(course.enURL).then(res => {
//        if (res.status === 200) {
//          const $ = cheerio.load(res.data)
//          if ($('.tab_content.description p').length) {
//            course.descriptionEn = $('.tab_content.description p').text().trim()
//          } else {
//            course.descriptionEn = $('.tab_content.description').text().trim()
//          }
//        }
//      })
//    }
//   if (course.frURL) {
//     await axios.get(course.frURL).then(res => {
//       if (res.status === 200) {
//         const $ = cheerio.load(res.data)
//         if ($('.tab_content.description p').length) {
//           course.descriptionFr = $('.tab_content.description p')[0].children[0].data.trim()
//         } else {
//           course.descriptionFr = $('.tab_content.description').text().trim()
//         }
//         course.titleFr = $('#content h3 a')[0].children[0].data.trim()
//         course.publishDateFr = $('strong:contains("Publish Date")')[0].next.data.trim()
//       }
//     })
//   }
// }