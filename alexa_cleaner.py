import csv
from tld import get_tld
import tld

known_tlds = set()

with open('hosts.csv', 'wt') as hosts:
  spamwriter = csv.writer(hosts, delimiter=',',
                          quotechar='|', quoting=csv.QUOTE_MINIMAL)
  with open('top-1m.csv', 'rt') as csvfile:
        spamreader = csv.reader(csvfile, delimiter=',', quotechar='|')
        for row in spamreader:
            tld = "http://"+row[1]
            try:
              tld = "http://"+get_tld(tld)
            except Exception as err:
              print(err)
              pass
            if tld in known_tlds: continue
            known_tlds.add(tld)
            spamwriter.writerow([row[0], tld])
            
    
