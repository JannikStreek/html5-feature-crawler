//command to call script: phantomjs --ignore-ssl-errors=yes --ssl-protocol=any test.js http://twitter.com
//timeout idea: https://gist.github.com/cjoudrey/1341747
var page = require('webpage').create(),
    system = require('system'),
    steps;
page.settings.resourceTimeout = 2000;
page.onLongRunningScript = function() {
  page.stopJavaScript();
};

waiting = 0;
resourceWait = 300;
maxRenderWait = 10000;
forcedRenderTimeout = 0;
renderTimeout = 0;
run = 0;

String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

result = {sessionstorage:0, localstorage:0, indexeddb:0, websql:0, fileapi:0, html5doctype:0, cachemanifest: 0, cachecontrol:""};
page.captureContent = ['.*'];//\.js

page.onError = function (msg,trace) {
  //discard silently
};

//page.onConsoleMessage = function(msg) {
//   console.log('console: ' + msg);
//};

//page.onError = function (msg, trace) {
//   console.log(msg);
//    trace.forEach(function(item) {
//        console.log('  ', item.file, ':', item.line);
//    })
//}

//, '*/js/*'
checkForHTML5Features = function(data) {
  if(result['sessionstorage'] == 0 && data.match(/sessionStorage/)) result['sessionstorage'] = 1;
  if(result['localstorage'] == 0 &&data.match(/localStorage/)) result['localstorage'] = 1;
  if(result['indexeddb'] == 0 &&data.match(/[i|I]ndexedDB/)) result['indexeddb'] = 1;
  if(result['websql'] == 0 &&data.match(/openDatabase/)) result['websql'] = 1;
  if(result['fileapi'] == 0 &&data.match(/FileReader|\.files/)) result['fileapi'] = 1;
}

checkDoctype = function(doctype) {
  //console.log(doctype);
  if (doctype.toLowerCase() == "<!doctype html>" || doctype.toLowerCase() == '<!doctype html system "about:legacy-compat">') result['html5doctype'] = 1;
}

page.onResourceRequested = function(requestData, request) {
  url = requestData.url.toLowerCase();
  if (url.endsWith('.png') || url.endsWith('.css') || url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.gif') || url.endsWith('.ico') || url.endsWith('.xml')) {
    request.abort();
  }else{
    //console.log("requested: " + requestData['url']);
    waiting += 1;
    clearTimeout(renderTimeout);
  }
};

page.onResourceReceived = function(r) {
  if((!r.stage || r.stage === 'end') && r.url != "" ){
    console.log(r.url);
    waiting -= 1;
    if(r.contentType != null && r.contentType.indexOf("html") > -1 && run === 0) {
      //console.log(JSON.stringify(r.headers));
      r.headers.forEach(function(entry) {
        if(entry['name'].toLowerCase() === "cache-control") {
          result['cachecontrol'] = entry['value'];
          run = 1;
        }
      });
    }
    if(r.contentType != null && r.contentType.indexOf("javascript") > -1) checkForHTML5Features(r.body);
    if (waiting === 0) {
      renderTimeout = setTimeout(doRender, resourceWait);
    }
  }
  
};

mergeResult = function(new_result) {
  for (var property in new_result) {
      if (new_result.hasOwnProperty(property) && new_result[property] == 1) {
          result[property] = 1;
      }
  }
}

function doRender() {
  var data = page.evaluate(function() {
      
      //has to be copied because we are now inside the webpage and have no access to the other function
      checkForHTML5Features = function(data) {
        if(result['sessionstorage'] == 0 && data.match(/sessionStorage/)) result['sessionstorage'] = 1;
        if(result['localstorage'] == 0 &&data.match(/localStorage/)) result['localstorage'] = 1;
        if(result['indexeddb'] == 0 &&data.match(/[i|I]ndexedDB/)) result['indexeddb'] = 1;
        if(result['websql'] == 0 &&data.match(/openDatabase/)) result['websql'] = 1;
        if(result['fileapi'] == 0 &&data.match(/FileReader/)) result['fileapi'] = 1;
      }
      var node = document.doctype;
      var result = {sessionstorage:0, localstorage:0, indexeddb:0, websql:0, fileapi:0, cachemanifest:0};
      var html = ""
      if(node != null) {
        html = "<!DOCTYPE "
             + node.name
             + (node.publicId ? ' PUBLIC "' + node.publicId + '"' : '')
             + (!node.publicId && node.systemId ? ' SYSTEM' : '') 
             + (node.systemId ? ' "' + node.systemId + '"' : '')
             + '>';
      }
      try {
        var scripts = document.querySelectorAll('script');
        for(var i = 0; i < scripts.length; ++i) {
            checkForHTML5Features(scripts[i].innerHTML);
        }
      } catch(err) {
        console.log(err);
      }

      if(document.querySelector('html').getAttribute('manifest') != null) {
        result['cachemanifest'] = 1;
      }

      return {'html5doctype': html, 'result': result};
    });
    checkDoctype(data['html5doctype']);
    mergeResult(data['result']);
    console.log(JSON.stringify(result));
    phantom.exit();
}

page.open(encodeURI(system.args[1]), function (status) {
  forcedRenderTimeout = setTimeout(function () {
    //console.log(waiting);
    doRender();
  }, maxRenderWait);
  phantom.exit();
});
