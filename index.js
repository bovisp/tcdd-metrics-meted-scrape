require('dotenv').config()
const axios = require('axios')
const cheerio = require('cheerio')
var mysql      = require('mysql')

const baseURL = 'https://www.meted.ucar.edu'

const scrapeEnglishCourses = () => {
  var connection = mysql.createConnection({
    host     : process.env.DB_HOST,
    user     : process.env.DB_USER,
    password : process.env.DB_PASS,
    database : process.env.DB_DATABASE
  })
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
          courseObj.title =  $(el).find('.module_title h5 a').text().trim()
          courseObj.publishDate =  $(el).find('strong:contains("Publish Date")')[0].next.data
          courseObj.lastUpdated =  $(el).find('strong:contains("Last Updated On")').length ? $(el).find('strong:contains("Last Updated On")')[0].next.data : courseObj.publishDate
          courseObj.completionTime =  $(el).find('strong:contains("Completion Time")')[0].next.data
          courseObj.imageSrc =  `https://www.meted.ucar.edu${$(el).find('li.thumbnail a img')[0].attribs.src}`
          courseObj.description =  $(el).find('li.description p')[0].children[0].data
          courseObj.topicsArr = []
          
          $(el)
            .find('.module_title a[href*="training_detail"]')
            .each((i, el) => {
              courseObj.topicsArr.push($(el).text())
            })
            courseObj.topics = courseObj.topicsArr.reduce((list, topic) => list + ', ' + topic).trimRight(', ')
  
          const enLink =  $(el)
          .find('.module_title a[href*="training_module"]:contains("English")')
          courseObj.URL = enLink.length ? `${baseURL}/${enLink[0].attribs.href}` : ''
  
          courseArr.push(courseObj)
        })
  
        console.log(`Processed English page ${pgNum}!`)
  
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
        course.title = course.title.replace(/"/g, '&quot;')
        course.description = course.description.replace(/"/g, '&quot;')
  
        connection.query(`
          INSERT INTO comet_modules (title, publish_date, last_updated, completion_time, image_src, description, topics, url, language_id)
          VALUES ("${course.title}", "${course.publishDate}", "${course.lastUpdated}", "${course.completionTime}", "${course.imageSrc}", "${course.description}", "${course.topics}", "${course.URL}", "1")`, function (error, results, fields) {
          if (error)
            throw error;
          // connected!
        });
      })
      console.log('Inserted English courses into database!')
    });
  }

  processEnglishCoursesByPage(1)
}


const scrapeFrenchCourses = () => {
  var connection = mysql.createConnection({
    host     : process.env.DB_HOST,
    user     : process.env.DB_USER,
    password : process.env.DB_PASS,
    database : process.env.DB_DATABASE
  })
  let courseArr = []
  let highestPgNum = null
  let courseNum = null

  const processFrenchCoursesByPage = (pgNum) => { axios.get(`${baseURL}/training_detail.php?page=${pgNum}&languageSorting=2`).then(async res => {
      if(res.status === 200) {
        const $ = cheerio.load(res.data)
  
        if(!courseNum)
          courseNum = $('.mod_count','.module_listing.detail_view').find('strong')[1].children[0].data
  
        let courseNodesArr = $('ul.mod.detail_view.group').toArray()
  
        for(let el of courseNodesArr) {
          const courseObj = {}
          courseObj.title =  $(el).find('.module_title h5 a').text().trim()
          courseObj.publishDate =  $(el).find('strong:contains("Publish Date")')[0].next.data
          courseObj.lastUpdated =  $(el).find('strong:contains("Last Updated On")').length ? $(el).find('strong:contains("Last Updated On")')[0].next.data : courseObj.publishDate
          courseObj.completionTime =  $(el).find('strong:contains("Completion Time")')[0].next.data
          courseObj.imageSrc =  `https://www.meted.ucar.edu${$(el).find('li.thumbnail a img')[0].attribs.src}`
          //courseObj.descriptionFr =  $(el).find('li.description p')[0].children[0].data
          courseObj.description = ''
          courseObj.topicsArr = []
          
          $(el)
            .find('.module_title a[href*="training_detail"]')
            .each((i, el) => {
              courseObj.topicsArr.push($(el).text())
            })
            courseObj.topics = courseObj.topicsArr.reduce((list, topic) => list + ', ' + topic).trimRight(', ')
  
          const frLink =  $(el)
            .find('.module_title a[href*="training_module"]:contains("French")')
          courseObj.URL = frLink.length ? `${baseURL}/${frLink[0].attribs.href}` : ''
  
          const enLink =  $(el)
          .find('.module_title a[href*="training_module"]:contains("English")')
          courseObj.enURL = enLink.length ? `${baseURL}/${enLink[0].attribs.href}` : ''
  
          let res = await axios.get(courseObj.URL);
          if (res.status === 200) {
            const $ = await cheerio.load(res.data)
            if ($('.tab_content.description p').length) {
              courseObj.description = await $('.tab_content.description p')[0].children[0].data.trim()
            } else {
              courseObj.description = await $('.tab_content.description')[0].children[0].data.trim()
            }
          }
          courseArr.push(courseObj)
        }
  
        console.log(`Processed French page ${pgNum}!`)
  
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
  
    connection.connect(async function(err) {
      if (err) {
        console.error('error connecting: ' + err.stack);
        return;
      }
  
      courseArr.forEach(course => {
        course.title = course.title.replace(/"/g, '&quot;')
        course.description = course.description.replace(/"/g, '&quot;')
  
        connection.query(`SELECT id FROM comet_modules WHERE url = "${course.enURL}"`, function(err, result, fields) {
          if (err) throw err;
          let englishVersionId = result[0].id
  
          connection.query(`
          INSERT INTO comet_modules (title, publish_date, last_updated, completion_time, image_src, description, topics, url, language_id, english_version_id)
          VALUES ("${course.title}", "${course.publishDate}", "${course.lastUpdated}", "${course.completionTime}", "${course.imageSrc}", "${course.description}", "${course.topics}", "${course.URL}", "2", "${englishVersionId}")`, function (err, results, fields) {
            if (err) throw err;
          });
        })
      })
      console.log('Inserted French courses into database!')
    });
  }

  processFrenchCoursesByPage(1)
}

scrapeEnglishCourses()
scrapeFrenchCourses()