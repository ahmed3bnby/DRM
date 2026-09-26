import importlib.util,unittest
spec=importlib.util.spec_from_file_location('public_lists','scripts/connectors/public_lists.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Parsers(unittest.TestCase):
 def test_un_alias_original_and_identity(self):
  r=m.parse_xml('UN',b'<CONSOLIDATED_LIST><INDIVIDUAL><DATAID>1</DATAID><FIRST_NAME>Test</FIRST_NAME><SECOND_NAME>Person</SECOND_NAME><INDIVIDUAL_ALIAS><ALIAS_NAME>Other</ALIAS_NAME></INDIVIDUAL_ALIAS></INDIVIDUAL></CONSOLIDATED_LIST>')[0]
  self.assertEqual(r['id'],'1');self.assertEqual(r['name'],'Test Person');self.assertEqual(r['aliases'],['Other'])
 def test_ofac_namespace(self):
  r=m.parse_xml('OFAC',b'<sdnList xmlns="example"><sdnEntry><uid>2</uid><lastName>Test Company</lastName><sdnType>Entity</sdnType><programList><program>TEST</program></programList></sdnEntry></sdnList>')[0]
  self.assertEqual(r['kind'],'company');self.assertEqual(r['details']['program'],['TEST'])
 def test_uk_repeated_ids_preserve_aliases(self):
  s=b'Unique ID,Name 1,Name 2,Name 3,Name 4,Name 5,Name 6,Designation Type\nA,Test,,,,,Company,Entity\nA,Other,,,,,Company,Entity\n'
  r=m.parse_uk(s);self.assertEqual(len(r),1);self.assertEqual(r[0]['aliases'],['Other Company'])
 def test_uk_continuation_rows_and_native_alias(self):
  s="Unique ID,Name 1,Name 6,Designation Type,Name non-latin script,Address Country\nA,Test,Company,Entity,شركة اختبار,AE\nA,,,Entity,,GB\n".encode()
  r=m.parse_uk(s)[0];self.assertEqual(r["aliases"],["شركة اختبار"]);self.assertEqual(r["details"]["Address Country"],["AE","GB"]);self.assertEqual(r["kind"],"company")
 def test_malformed_and_empty_rejected(self):
  for code,raw in [('UN',b'<CONSOLIDATED_LIST/>'),('UN',b'<html/>'),('OFAC',b'<!DOCTYPE x><sdnList/>')]:
   with self.assertRaises(ValueError):m.parse_xml(code,raw)
if __name__=='__main__':unittest.main()
