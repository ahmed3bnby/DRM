import importlib.util
import json
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('connector', Path(__file__).parents[1]/'scripts/connectors/opensanctions.py')
connector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(connector)

class RichSourcesTest(unittest.TestCase):
    def sample(self):
        return {'id':'fixture-1','caption':'Example Person','schema':'Person','datasets':['fixture'],
                'properties':{'name':['Example Person','أحمد علي'], 'birthDate':['1970-01-02'],
                 'ownershipOwner':[{'id':'edge-1','schema':'Ownership','caption':'Example relationship',
                   'properties':{'asset':[{'id':'other-1','schema':'Company','caption':'Related Company',
                     'properties':{'name':['Related Company'],'idNumber':['OTHER-ID']}}], 'percentage':['25']}}],
                 'sanctions':[{'id':'sanction-1','schema':'Sanction','caption':'Example listing',
                     'properties':{'reason':['Published reason'],'sourceUrl':['https://example.org/evidence']}}]}}
    def parse(self,item):
        return connector.parse_nested(json.dumps(item,ensure_ascii=False).encode(),{'version':'v1'})[0]
    def test_preserves_evidence_and_relationship_direction(self):
        r=self.parse(self.sample())
        self.assertEqual(r['details']['ownershipOwner'][0]['properties']['percentage'],['25'])
        self.assertEqual(r['details']['sanctions'][0]['properties']['sourceUrl'],['https://example.org/evidence'])
    def test_related_identity_does_not_become_subject_identity(self):
        r=self.parse(self.sample())
        self.assertEqual(r['aliases'],['أحمد علي'])
        self.assertNotIn('idNumber',r['details'])
        self.assertEqual(r['details']['birthDate'],['1970-01-02'])
    def test_invalid_or_duplicate_records_abort_whole_snapshot(self):
        with self.assertRaises(ValueError): self.parse({'id':'broken'})
        line=json.dumps(self.sample())
        with self.assertRaises(ValueError): connector.parse_nested((line+'\n'+line).encode(),{})
    def test_provenance_and_missing_information_not_invented(self):
        r=self.parse(self.sample())
        self.assertEqual(r['details']['_provenance']['upstreamVersion'],'v1')
        self.assertNotIn('address',r['details'])
    def test_empty_source_is_not_accepted(self):
        with self.assertRaises(ValueError): connector.parse_nested(b'\n',{})

if __name__=='__main__': unittest.main()
