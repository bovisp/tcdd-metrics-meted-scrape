const request = require('request')
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

request('https://meted.ucar.edu/training_detail.php?page=showAll&languageSorting=1', (err, res, html) => {
  if (!err && res.statusCode === 200) {
    const $ = cheerio.load(html)

     $('ul.mod.detail_view.group').each(async (i, el) => {
      const courseObj = {}

      courseObj.titleEn =  $(el).find('.module_title h5 a').text()
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

      const frLink =  $(el)
        .find('.module_title a[href*="training_module"]:contains("French")')

      courseObj.frURL = frLink.length ? `${baseURL}/${frLink[0].attribs.href}` : ''

      courseObj.titleFr = ''
      courseObj.descriptionFr = ''
      courseObj.publishDateFr = ''

      courseArr.push(courseObj)
    })

    courseArr.forEach(async (course, index) => {
      if (course.frURL) {
        await request(course.frURL, async (err, res, html) => {
          if (!err && res.statusCode === 200) {
            const $ = await cheerio.load(html)

            if ($('.tab_content.description p').length) {
              courseArr[index].descriptionFr = await $('.tab_content.description p')[0].children[0].data.trim()
            } else {
              courseArr[index].descriptionFr = await $('.tab_content.description')[0].children[0].data.trim()
            }

            courseArr[index].titleFr = await $('#content h3 a')[0].children[0].data
            courseArr[index].publishDateFr = await $('strong:contains("Publish Date")')[0].next.data
          }
        })
      }
    })
  }
})

setTimeout(() => {
  connection.connect(function(err) {
    if (err) {
      console.error('error connecting: ' + err.stack);
      return;
    }
   
    courseArr.forEach(course => {
      connection.query(`
        INSERT INTO test (titleEn, publishDateEn, completionTime, imageSrcEn, descriptionEn, frURL, titleFr, descriptionFr, publishDateFr)
        VALUES ("${course.titleEn}", "${course.publishDateEn}", "${course.completionTime}", "${course.imageSrcEn}", "${course.descriptionEn}", "${course.frURL}", "${course.titleFr}", "${course.descriptionFr}", "${course.publishDateFr}")`, function (error, results, fields) {
        if (error) throw error;
        // connected!
      });
    })
  });
}, 90000)