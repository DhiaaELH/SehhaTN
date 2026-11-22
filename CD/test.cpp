#include <iostream>
#include <vector>
#include <cmath>
#include <numeric>

using namespace std;

bool pairwise(int arr[], int i, int j, int n) {
    // Loop through every element in the array
    for (int k = 0; k < n; k++) {
        // Condition: Check if 'k' is OUTSIDE the excluded range [i, j]
        // An index is outside if it is strictly less than i OR strictly greater than j
        if (k < i || k > j) {
            
            // Compare it with all previous elements 'h' that are also outside the range
            for (int h = 0; h < k; h++) {
                if (h < i || h > j) {
                    
                    // If a duplicate is found outside the range, return false immediately
                    if (arr[h] == arr[k]) {
                        return false; 
                    }
                }
            }
        }
    }
    return true; // No duplicates found outside the range
}

int main() {
    int n;
    int query_i;
    int query_j;
    int arr[2000];

    if (!(cin >> n)) return 0;
    
    for (int idx = 0; idx < n; idx++) {
        cin >> arr[idx];
    }

    while (true) {
        cin >> query_i;
        // Check for exit condition immediately after reading the first coordinate
        if (query_i == -1) {
            break;
        }
        cin >> query_j;
        
        cout << pairwise(arr, query_i, query_j, n) << endl;
    }
    return 0;
}
