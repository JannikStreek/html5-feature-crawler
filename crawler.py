import csv
import json
import logging
import pymysql
import socket
from multiprocessing import Process
import cProfile, pstats, io
import subprocess
import os
import signal

#deps
#pip install pymsql

# db connection info
HOSTNAME = "localhost"
USERNAME = "root"
PASSWORD = "root"
DATABASE = "html5dbsurvey"
# threads
NUMBER_PROCS = 10
# logging config
logging.basicConfig(filename='crawler.log',level=logging.DEBUG)

class HTML5DBSurvey:
  def __init__(self):
    self.global_set = []
    self.csv_lower_limit = 0
    self.csv_upper_limit = 100
    self.global_set = []
  def read_from_csv(self):
    with open('hosts.csv', 'rt') as csvfile:
      spamreader = csv.reader(csvfile, delimiter=',', quotechar='|')
      for row in spamreader:
        if int(row[0]) > self.csv_upper_limit:
          break
        if int(row[0]) > self.csv_lower_limit:
          self.global_set.append({'host': row[1], 'order':row[0]})
  def run(self):
    self.spawn_processes(self.global_set, NUMBER_PROCS)
  def spawn_processes(self, data, num_procs):
    procs = []

    chunksize = int(len(data)/num_procs)
    remainder = int(len(data)%num_procs)
    logging.info("Processing " + str(len(data)) + " entries with " + str(num_procs) + " processes (chunksize: " + str(chunksize) + ").")
    for i in range(num_procs):
        logging.info("Starting Proc "+str(i))
        p = Process(
                target=Crawler,
                args=([data[chunksize * i:chunksize * (i + 1)]]))
        procs.append(p)
        p.start()

    # do the rest ourselves
    logging.info("remainder = " + str(remainder))
    if remainder > 0:
      Crawler(data[chunksize * num_procs + 1:])
    # Wait for all worker processes to finish
    i = 1
    for p in procs:
      p.join()
      logging.info("Process " + str(i) + "/" + str(num_procs) + " finished.")
      i += 1
    exit()
  def single_test(self, url):
    Crawler([{'host':url,'order':0}])

class Crawler:
  conn = None
  c = None
  def __init__(self, data):
    self.result = {}
    self.conn = pymysql.connect(host=HOSTNAME,
                                user=USERNAME,
                                passwd=PASSWORD,
                                db=DATABASE)
    self.c = self.conn.cursor()
    self.data = data
    self.start()
    self.conn.close()
  def start(self):
    for row in self.data:
      self.page_to_crawl = row['host']
      self.order = row['order']
      if(self.crawl() == True):
        self.save_results()
      self.result = {}
  def crawl(self):
    p = subprocess.Popen("phantomjs --ignore-ssl-errors=yes --ssl-protocol=any phantom_crawler.js "+self.page_to_crawl, shell=True, stdout=subprocess.PIPE, preexec_fn=os.setsid)
    try:
      out, err = p.communicate(timeout=40)
      result = out.decode("utf-8")
      data = json.loads(result)
      self.result = data
    except Exception as e:
      if p.poll() == None:
        logging.warning("PhantomJS crashed / Timeout / Bad JSON - killing pid " + str(p.pid) + " for url " + self.page_to_crawl)
        os.killpg(p.pid, signal.SIGTERM)
      logging.warning(e)
      return False
    if p.poll() == None:
      logging.warning("PhantomJS returned but not finished - killing pid " + str(p.pid) + " for url " + self.page_to_crawl)
      os.killpg(p.pid, signal.SIGTERM)
    return True
  def save_results(self):
    #logging.info("Result: "+str(self.result))
    try:
      self.c.execute("INSERT INTO crawls (order_alexa,host,cachecontrol,html5doctype,localstorage,sessionstorage,fileapi,indexeddb,websql,cachemanifest) VALUES ("+str(self.order)+",'"+self.page_to_crawl+"','"+str(self.result['cachecontrol'])+"',"+str(self.result['html5doctype'])+","+str(self.result['localstorage'])+","+str(self.result['sessionstorage'])+","+str(self.result['fileapi'])+","+str(self.result['indexeddb'])+","+str(self.result['websql'])+","+str(self.result['cachemanifest'])+")")
      self.conn.commit()
    except Exception as err:
      logging.error(err)

survey = HTML5DBSurvey()
survey.read_from_csv()
survey.run()
#survey.single_test('http://twitter.com')

