#include <iostream>
#include <vector>
#include <cmath>
using namespace std;
#include <numeric>

bool parwise(int arr[], int i , int j , int n){
    int k =0;
    int h=1;
    while (k<n && (k<=i || k>j)){
        while (h<k && (h<=i || h>j)){
            if (arr[h]=arr[k]){
                return false;
            }
            else{
                k=k+1;
                h=h+1;
            }
        }

    }
    return true;


}
int main(){
    int n;
    int arr[2000];
    int l=-1;
    int r=-1;
    
    

    cin>>n;
    for (int i=0; i<n; i++){
        cin>>arr[i];
        }
    for (int i=0; i<n; i++){
        for (int j=i+1; j<n; j++){

            if (l==-1 && arr[i]==arr[j]){
                l=i;
                cout<<"l= "<<r<<endl;
            }

            if (arr[i]==arr[j]){
                r=j;
                cout<<"r= "<<r<<endl;
            }
            
            }
            
            }
    if (l==-1){
                cout<<0<<endl;
            }
    else{
                cout<<r-l-1<<endl;
    }
    
    return 0;
}